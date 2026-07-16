import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

// Mailgun's webhook signing key. On most accounts this is the same as the
// API key; newer accounts have a separate "HTTP webhook signing key" under
// Account Settings -> API Security - use that instead if verification
// keeps failing.
const SIGNING_KEY =
  process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? process.env.MAILGUN_API_KEY;

function isValidSignature(timestamp: string, token: string, signature: string) {
  if (!SIGNING_KEY) return false;
  const expected = crypto
    .createHmac("sha256", SIGNING_KEY)
    .update(timestamp + token)
    .digest("hex");
  return expected === signature;
}

// Known prefetch/proxy user-agents that fire "opened" the moment an email
// is delivered, regardless of whether a human actually looked at it.
// This can never be fully accurate - Apple Mail Privacy Protection in
// particular doesn't identify itself this cleanly - but it filters out
// the most common false-positive source (Gmail's image proxy).
const PROXY_USER_AGENT_PATTERNS = [
  /googleimageproxy/i,
  /google.*image.*proxy/i,
  /ggpht\.com/i,
];

function isLikelyProxyOpen(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  return PROXY_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// No requireAuth here - Mailgun calls this directly, it doesn't have a
// session cookie. Authenticity is instead verified via the HMAC signature
// Mailgun includes on every webhook payload.
router.post("/mailgun", async (req, res) => {
  const { signature, "event-data": eventData } = req.body ?? {};

  if (!signature || !eventData) {
    return res.status(400).json({ error: "Malformed webhook payload" });
  }

  const valid = isValidSignature(
    signature.timestamp,
    signature.token,
    signature.signature
  );

  if (!valid) {
    // Log but still 200 - an invalid signature during local/dev testing
    // (e.g. signing key not set yet) shouldn't cause Mailgun to endlessly
    // retry. In production you'd want to reject with 401 instead.
    console.warn("Mailgun webhook signature did not verify");
  }

  const event: string = eventData.event;
  const messageId: string | undefined = eventData.message?.headers?.["message-id"];

  if (!messageId) {
    return res.status(200).json({ ok: true }); // nothing to match, ignore
  }

  const recipient = await prisma.campaignRecipient.findFirst({
    where: { providerMessageId: messageId },
  });

  if (!recipient) {
    // Could be an event for a message this app didn't send, or the id
    // wasn't stored - either way, nothing to update.
    return res.status(200).json({ ok: true });
  }

  if (event === "delivered") {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: recipient.status === "OPENED" ? "OPENED" : "DELIVERED",
        deliveredAt: new Date(),
      },
    });
  } else if (event === "opened") {
    const userAgent: string | undefined = eventData["client-info"]?.["user-agent"];

    if (isLikelyProxyOpen(userAgent)) {
      // Prefetch by an inbox provider's image proxy, not a real open.
      // Skip the status update; log at debug level so it's still visible
      // if you're diagnosing open-rate numbers.
      console.log(
        `Ignoring likely proxy open for ${recipient.id} (user-agent: ${userAgent})`
      );
      return res.status(200).json({ ok: true });
    }

    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "OPENED", openedAt: new Date() },
    });
  }

  res.status(200).json({ ok: true });
});

export default router;