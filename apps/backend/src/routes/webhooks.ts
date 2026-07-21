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

// How soon after "delivered" an "opened" event has to arrive for us to
// treat it as an automated prefetch rather than a real human open.
// Real opens - even fast ones where someone has the inbox open and
// clicks in immediately - essentially never land inside this window;
// prefetch happens as part of delivery itself, so it's near-instant.
const PROXY_OPEN_WINDOW_SECONDS = 5;

function matchesProxyUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  return PROXY_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

// Decide whether an "opened" event is a bot/proxy prefetch rather than a
// genuine human open.
//
// Mailgun's `client-info.bot` field (e.g. "gmail") tells us the request
// came through an inbox provider's proxy - but that's not enough on its
// own, because Gmail routes ALL image loads (including real ones a human
// triggers by opening the mail) through the same proxy infrastructure.
// So a "gmail" bot tag can show up on a totally genuine open too.
//
// The thing prefetch-driven opens have in common is *timing*: they fire
// within a second or two of "delivered", before a human could plausibly
// have seen the email. A real open - even a fast one - happens after the
// notification arrives, the person switches to their mail app, and the
// message renders, which takes noticeably longer than that.
//
// So: only treat it as a proxy open when BOTH the bot flag/user-agent
// pattern matches AND it happened suspiciously fast after delivery.
function isLikelyProxyOpen(params: {
  userAgent: string | undefined | null;
  bot: string | undefined | null;
  secondsSinceDelivery: number | null;
}): boolean {
  const { userAgent, bot, secondsSinceDelivery } = params;

  const flaggedAsBot = Boolean(bot && bot.trim() !== "");
  const looksLikeProxyUA = matchesProxyUserAgent(userAgent);

  if (!flaggedAsBot && !looksLikeProxyUA) return false;

  // If we don't have a delivered timestamp to compare against, fall back
  // to trusting the bot/user-agent signal alone.
  if (secondsSinceDelivery === null) return flaggedAsBot || looksLikeProxyUA;

  return secondsSinceDelivery < PROXY_OPEN_WINDOW_SECONDS;
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
    const bot: string | undefined = eventData["client-info"]?.["bot"];

    const deliveredAt = recipient.deliveredAt;
    const openedAt = new Date();
    const secondsSinceDelivery = deliveredAt
      ? (openedAt.getTime() - new Date(deliveredAt).getTime()) / 1000
      : null;

    console.log(
      `[DEBUG] opened event - bot: ${JSON.stringify(bot)}, userAgent: ${JSON.stringify(
        userAgent
      )}, secondsSinceDelivery: ${secondsSinceDelivery}`
    );

    if (isLikelyProxyOpen({ userAgent, bot, secondsSinceDelivery })) {
      console.log(
        `Ignoring likely proxy open for ${recipient.id} (bot: ${bot}, secondsSinceDelivery: ${secondsSinceDelivery})`
      );
      return res.status(200).json({ ok: true });
    }

    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: "OPENED", openedAt },
    });
  }

  res.status(200).json({ ok: true });
});

export default router;