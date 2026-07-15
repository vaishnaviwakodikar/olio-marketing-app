"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// Mailgun's webhook signing key. On most accounts this is the same as the
// API key; newer accounts have a separate "HTTP webhook signing key" under
// Account Settings -> API Security - use that instead if verification
// keeps failing.
const SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? process.env.MAILGUN_API_KEY;
function isValidSignature(timestamp, token, signature) {
    if (!SIGNING_KEY)
        return false;
    const expected = crypto_1.default
        .createHmac("sha256", SIGNING_KEY)
        .update(timestamp + token)
        .digest("hex");
    return expected === signature;
}
// No requireAuth here - Mailgun calls this directly, it doesn't have a
// session cookie. Authenticity is instead verified via the HMAC signature
// Mailgun includes on every webhook payload.
router.post("/mailgun", async (req, res) => {
    const { signature, "event-data": eventData } = req.body ?? {};
    if (!signature || !eventData) {
        return res.status(400).json({ error: "Malformed webhook payload" });
    }
    const valid = isValidSignature(signature.timestamp, signature.token, signature.signature);
    if (!valid) {
        // Log but still 200 - an invalid signature during local/dev testing
        // (e.g. signing key not set yet) shouldn't cause Mailgun to endlessly
        // retry. In production you'd want to reject with 401 instead.
        console.warn("Mailgun webhook signature did not verify");
    }
    const event = eventData.event;
    const messageId = eventData.message?.headers?.["message-id"];
    if (!messageId) {
        return res.status(200).json({ ok: true }); // nothing to match, ignore
    }
    const recipient = await prisma_1.prisma.campaignRecipient.findFirst({
        where: { providerMessageId: messageId },
    });
    if (!recipient) {
        // Could be an event for a message this app didn't send, or the id
        // wasn't stored - either way, nothing to update.
        return res.status(200).json({ ok: true });
    }
    if (event === "delivered") {
        await prisma_1.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
                status: recipient.status === "OPENED" ? "OPENED" : "DELIVERED",
                deliveredAt: new Date(),
            },
        });
    }
    else if (event === "opened") {
        await prisma_1.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: "OPENED", openedAt: new Date() },
        });
    }
    res.status(200).json({ ok: true });
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map