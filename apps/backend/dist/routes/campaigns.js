"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const audiences_1 = require("./audiences");
const campaignQueue_1 = require("../queue/campaignQueue");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
const campaignSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1),
    subject: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1),
    recipientSource: zod_1.z.enum(["AUDIENCE", "PASTED_LIST"]),
    audienceId: zod_1.z.string().optional(),
    tag: zod_1.z.string().optional(),
    // Free-form textarea: emails/phones separated by commas/newlines/spaces
    pastedList: zod_1.z.string().optional(),
    // ISO datetime string; omit to send immediately
    sendAt: zod_1.z.string().datetime().optional(),
})
    .refine((d) => d.recipientSource !== "AUDIENCE" || d.audienceId || d.tag, { message: "audienceId or tag is required when recipientSource is AUDIENCE" })
    .refine((d) => d.recipientSource !== "PASTED_LIST" || !!d.pastedList?.trim(), { message: "pastedList is required when recipientSource is PASTED_LIST" });
router.post("/", async (req, res) => {
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;
    const workspaceId = req.workspaceId;
    let recipients = [];
    if (data.recipientSource === "AUDIENCE") {
        let filter = {};
        if (data.audienceId) {
            const audience = await prisma_1.prisma.audience.findFirst({
                where: { id: data.audienceId, workspaceId },
            });
            if (!audience) {
                return res.status(404).json({ error: "Audience not found" });
            }
            filter = audience.filter;
        }
        else if (data.tag) {
            filter = { tag: data.tag };
        }
        const members = await (0, audiences_1.resolveAudienceMembers)(workspaceId, filter);
        recipients = members.map((m) => ({
            contactId: m.id,
            status: "PENDING",
        }));
    }
    else {
        // PASTED_LIST: split on commas/newlines/whitespace, match each token
        // against saved contacts by email or phone.
        const tokens = data.pastedList
            .split(/[\s,]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        const contacts = await prisma_1.prisma.contact.findMany({ where: { workspaceId } });
        const byEmail = new Map(contacts
            .filter((c) => c.email)
            .map((c) => [c.email.toLowerCase(), c]));
        const byPhone = new Map(contacts.filter((c) => c.phone).map((c) => [c.phone, c]));
        for (const token of tokens) {
            const isEmail = token.includes("@");
            const match = isEmail
                ? byEmail.get(token.toLowerCase())
                : byPhone.get(token);
            if (match) {
                recipients.push({ contactId: match.id, status: "PENDING" });
            }
            else {
                recipients.push({
                    ...(isEmail ? { rawEmail: token } : { rawPhone: token }),
                    status: "UNMATCHED",
                });
            }
        }
    }
    if (recipients.length === 0) {
        return res.status(400).json({ error: "No recipients resolved" });
    }
    // -------------------------------------------------------------------
    // Create campaign + recipients, then enqueue the real send job
    // -------------------------------------------------------------------
    const sendAt = data.sendAt ? new Date(data.sendAt) : undefined;
    const isScheduledForFuture = sendAt && sendAt.getTime() > Date.now();
    const campaign = await prisma_1.prisma.campaign.create({
        data: {
            name: data.name,
            subject: data.subject,
            body: data.body,
            recipientSource: data.recipientSource,
            audienceId: data.audienceId,
            scheduledAt: sendAt,
            status: isScheduledForFuture ? "SCHEDULED" : "DRAFT",
            workspaceId,
            recipients: { createMany: { data: recipients } },
        },
        include: { recipients: true },
    });
    const jobId = await (0, campaignQueue_1.enqueueCampaignSend)(campaign.id, sendAt);
    await prisma_1.prisma.campaign.update({
        where: { id: campaign.id },
        data: { queueJobId: jobId },
    });
    const matched = recipients.filter((r) => r.status === "PENDING").length;
    const unmatched = recipients.filter((r) => r.status === "UNMATCHED").length;
    res.status(201).json({
        ...campaign,
        matchedCount: matched,
        unmatchedCount: unmatched,
    });
});
// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
    const campaigns = await prisma_1.prisma.campaign.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { createdAt: "desc" },
    });
    res.json(campaigns);
});
// ---------------------------------------------------------------------------
// Get one - includes recipients and status breakdown (basis for analytics)
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
    const campaign = await prisma_1.prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
        include: { recipients: { include: { contact: true } } },
    });
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }
    const counts = campaign.recipients.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});
    res.json({ ...campaign, statusCounts: counts });
});
// ---------------------------------------------------------------------------
// Delete / cancel a scheduled campaign
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
    const campaign = await prisma_1.prisma.campaign.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }
    if (campaign.queueJobId) {
        await (0, campaignQueue_1.cancelCampaignSend)(campaign.queueJobId);
    }
    await prisma_1.prisma.campaignRecipient.deleteMany({ where: { campaignId: campaign.id } });
    await prisma_1.prisma.campaign.delete({ where: { id: campaign.id } });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=campaigns.js.map