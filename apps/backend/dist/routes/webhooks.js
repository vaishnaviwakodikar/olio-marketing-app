"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();

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

router.post("/mailgun", async (req, res) => {
    const { signature, "event-data": eventData } = req.body ?? {};
    if (!signature || !eventData) {
        return res.status(400).json({ error: "Malformed webhook payload" });
    }
    const valid = isValidSignature(signature.timestamp, signature.token, signature.signature);
    if (!valid) {
        
        console.warn("Mailgun webhook signature did not verify");
    }
    const event = eventData.event;
    const messageId = eventData.message?.headers?.["message-id"];
    if (!messageId) {
        return res.status(200).json({ ok: true }); 
    }
    const recipient = await prisma_1.prisma.campaignRecipient.findFirst({
        where: { providerMessageId: messageId },
    });
    if (!recipient) {
       
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
