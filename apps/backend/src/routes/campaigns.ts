import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { resolveAudienceMembers } from "./audiences";
import { enqueueCampaignSend, cancelCampaignSend } from "../queue/campaignQueue";

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, plenty for a PDF attachment
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const campaignSchema = z
  .object({
    name: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    recipientSource: z.enum(["AUDIENCE", "PASTED_LIST"]),
    audienceId: z.string().optional(),
    tag: z.string().optional(),
    // Free-form textarea: emails/phones separated by commas/newlines/spaces
    pastedList: z.string().optional(),
    // ISO datetime string; omit to send immediately
    sendAt: z.string().datetime().optional(),
  })
  .refine(
    (d) =>
      d.recipientSource !== "AUDIENCE" || d.audienceId || d.tag,
    { message: "audienceId or tag is required when recipientSource is AUDIENCE" }
  )
  .refine(
    (d) => d.recipientSource !== "PASTED_LIST" || !!d.pastedList?.trim(),
    { message: "pastedList is required when recipientSource is PASTED_LIST" }
  );

router.post("/", upload.single("attachment"), async (req: AuthedRequest, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const workspaceId = req.workspaceId!;
  const attachmentFile = req.file; // present only if a PDF was attached

  // -------------------------------------------------------------------
  // Resolve recipients
  // -------------------------------------------------------------------
  type PendingRecipient = {
    contactId?: string;
    rawEmail?: string;
    rawPhone?: string;
    status: "PENDING" | "UNMATCHED";
  };
  let recipients: PendingRecipient[] = [];

  if (data.recipientSource === "AUDIENCE") {
    let filter: any = {};
    if (data.audienceId) {
      const audience = await prisma.audience.findFirst({
        where: { id: data.audienceId, workspaceId },
      });
      if (!audience) {
        return res.status(404).json({ error: "Audience not found" });
      }
      filter = audience.filter;
    } else if (data.tag) {
      filter = { tag: data.tag };
    }

    const members = await resolveAudienceMembers(workspaceId, filter);
    recipients = members.map((m: { id: string }) => ({
      contactId: m.id,
      status: "PENDING" as const,
    }));
  } else {
    // PASTED_LIST: split on commas/newlines/whitespace, match each token
    // against saved contacts by email or phone.
    const tokens = data.pastedList!
      .split(/[\s,]+/)
      .map((t: string) => t.trim())
      .filter(Boolean);

    const contacts = await prisma.contact.findMany({ where: { workspaceId } });
    const byEmail = new Map<string, (typeof contacts)[number]>(
      contacts
        .filter((c) => c.email)
        .map((c) => [c.email!.toLowerCase(), c])
    );
    const byPhone = new Map<string, (typeof contacts)[number]>(
      contacts.filter((c) => c.phone).map((c) => [c.phone!, c])
    );

    for (const token of tokens) {
      const isEmail = token.includes("@");
      const match = isEmail
        ? byEmail.get(token.toLowerCase())
        : byPhone.get(token);

      if (match) {
        recipients.push({ contactId: match.id, status: "PENDING" });
      } else {
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

  if (attachmentFile && attachmentFile.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Attachment must be a PDF file" });
  }

  // -------------------------------------------------------------------
  // Create campaign + recipients, then enqueue the real send job
  // -------------------------------------------------------------------
  const sendAt = data.sendAt ? new Date(data.sendAt) : undefined;
  const isScheduledForFuture = sendAt && sendAt.getTime() > Date.now();

  const campaign = await prisma.campaign.create({
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
      ...(attachmentFile && {
        attachmentFilename: attachmentFile.originalname,
        attachmentMimeType: attachmentFile.mimetype,
        attachmentData: attachmentFile.buffer,
      }),
    },
    include: { recipients: true },
  });

  const jobId = await enqueueCampaignSend(campaign.id, sendAt);
  await prisma.campaign.update({
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

router.get("/", async (req: AuthedRequest, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  res.json(campaigns);
});

// ---------------------------------------------------------------------------
// Get one - includes recipients and status breakdown (basis for analytics)
// ---------------------------------------------------------------------------

router.get("/:id", async (req: AuthedRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { recipients: { include: { contact: true } } },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const counts = campaign.recipients.reduce<Record<string, number>>(
    (acc: Record<string, number>, r: { status: string }) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  res.json({ ...campaign, statusCounts: counts });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { recipients: { include: { contact: true } } },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const counts = campaign.recipients.reduce<Record<string, number>>(
    (acc: Record<string, number>, r: { status: string }) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  res.json({ ...campaign, statusCounts: counts });
});

// ---------------------------------------------------------------------------
// Attachment - serve the stored PDF bytes for viewing/downloading
// ---------------------------------------------------------------------------

router.get("/:id/attachment", async (req: AuthedRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    select: {
      attachmentData: true,
      attachmentFilename: true,
      attachmentMimeType: true,
    },
  });

  if (!campaign || !campaign.attachmentData) {
    return res.status(404).json({ error: "No attachment found" });
  }

  res.setHeader(
    "Content-Type",
    campaign.attachmentMimeType ?? "application/pdf"
  );
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${campaign.attachmentFilename ?? "attachment.pdf"}"`
  );
  res.send(campaign.attachmentData);
});

// ---------------------------------------------------------------------------
// Duplicate - copy an existing campaign into a fresh draft
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Duplicate - copy an existing campaign into a fresh draft
// ---------------------------------------------------------------------------

router.post("/:id/duplicate", async (req: AuthedRequest, res) => {
  const workspaceId = req.workspaceId!;

  const original = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId },
    include: { recipients: true },
  });
  if (!original) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  type PendingRecipient = {
    contactId?: string;
    rawEmail?: string;
    rawPhone?: string;
    status: "PENDING" | "UNMATCHED";
  };
  let recipients: PendingRecipient[] = [];

  if (original.recipientSource === "AUDIENCE" && original.audienceId) {
    // Re-resolve membership fresh, since the audience may have changed
    // since the original campaign was created.
    const audience = await prisma.audience.findFirst({
      where: { id: original.audienceId, workspaceId },
    });

    if (audience) {
  const filter = (audience.filter ?? {}) as {
    fields?: { field: string; equals: string }[];
    tag?: string;
  };
  const members = await resolveAudienceMembers(workspaceId, filter);
      recipients = members.map((m: { id: string }) => ({
        contactId: m.id,
        status: "PENDING" as const,
      }));
    }
    // If the audience itself was deleted, fall through with empty
    // recipients rather than failing the duplicate outright - the user
    // can still edit and pick a new audience before sending.
  } else {
    // PASTED_LIST: copy the original recipient rows as-is, resetting
    // anything send-specific.
    recipients = original.recipients.map((r) => ({
      contactId: r.contactId ?? undefined,
      rawEmail: r.rawEmail ?? undefined,
      rawPhone: r.rawPhone ?? undefined,
      status: r.status === "UNMATCHED" ? ("UNMATCHED" as const) : ("PENDING" as const),
    }));
  }

  const duplicate = await prisma.campaign.create({
    data: {
      name: `Copy of ${original.name}`,
      subject: original.subject,
      body: original.body,
      recipientSource: original.recipientSource,
      audienceId: original.audienceId,
      status: "DRAFT",
      scheduledAt: null,
      queueJobId: null,
      workspaceId,
      // Carry the attachment over too, so duplicating a campaign really
      // does copy everything about it into a fresh editable draft.
      ...(original.attachmentData && {
        attachmentFilename: original.attachmentFilename,
        attachmentMimeType: original.attachmentMimeType,
        attachmentData: original.attachmentData,
      }),
      ...(recipients.length > 0
        ? { recipients: { createMany: { data: recipients } } }
        : {}),
    },
    include: { recipients: true },
  });

  res.status(201).json(duplicate);
});

// ---------------------------------------------------------------------------
// Edit + send a DRAFT campaign
// ---------------------------------------------------------------------------

router.put("/:id", upload.single("attachment"), async (req: AuthedRequest, res) => {
  const workspaceId = req.workspaceId!;
  const existing = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  if (existing.status !== "DRAFT") {
    return res.status(400).json({ error: "Only draft campaigns can be edited" });
  }

  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const attachmentFile = req.file;

  if (attachmentFile && attachmentFile.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Attachment must be a PDF file" });
  }

  // Re-resolve recipients from scratch, same logic as create
  type PendingRecipient = {
    contactId?: string;
    rawEmail?: string;
    rawPhone?: string;
    status: "PENDING" | "UNMATCHED";
  };
  let recipients: PendingRecipient[] = [];

  if (data.recipientSource === "AUDIENCE") {
    let filter: any = {};
    if (data.audienceId) {
      const audience = await prisma.audience.findFirst({
        where: { id: data.audienceId, workspaceId },
      });
      if (!audience) {
        return res.status(404).json({ error: "Audience not found" });
      }
      filter = audience.filter;
    } else if (data.tag) {
      filter = { tag: data.tag };
    }
    const members = await resolveAudienceMembers(workspaceId, filter);
    recipients = members.map((m: { id: string }) => ({
      contactId: m.id,
      status: "PENDING" as const,
    }));
  } else {
    const tokens = data.pastedList!
      .split(/[\s,]+/)
      .map((t: string) => t.trim())
      .filter(Boolean);

    const contacts = await prisma.contact.findMany({ where: { workspaceId } });
    const byEmail = new Map<string, (typeof contacts)[number]>(
      contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c])
    );
    const byPhone = new Map<string, (typeof contacts)[number]>(
      contacts.filter((c) => c.phone).map((c) => [c.phone!, c])
    );

    for (const token of tokens) {
      const isEmail = token.includes("@");
      const match = isEmail ? byEmail.get(token.toLowerCase()) : byPhone.get(token);
      if (match) {
        recipients.push({ contactId: match.id, status: "PENDING" });
      } else {
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

  const sendAt = data.sendAt ? new Date(data.sendAt) : undefined;
  const isScheduledForFuture = sendAt && sendAt.getTime() > Date.now();

  // Replace recipients: old ones (from the duplicate) are gone, fresh ones take over
  await prisma.campaignRecipient.deleteMany({ where: { campaignId: existing.id } });

  const campaign = await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      recipientSource: data.recipientSource,
      audienceId: data.audienceId,
      scheduledAt: sendAt,
      status: isScheduledForFuture ? "SCHEDULED" : "DRAFT",
      recipients: { createMany: { data: recipients } },
      ...(attachmentFile && {
        attachmentFilename: attachmentFile.originalname,
        attachmentMimeType: attachmentFile.mimetype,
        attachmentData: attachmentFile.buffer,
      }),
    },
    include: { recipients: true },
  });

  const jobId = await enqueueCampaignSend(campaign.id, sendAt);
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { queueJobId: jobId },
  });

  const matched = recipients.filter((r) => r.status === "PENDING").length;
  const unmatched = recipients.filter((r) => r.status === "UNMATCHED").length;

  res.json({ ...campaign, matchedCount: matched, unmatchedCount: unmatched });
});
// ---------------------------------------------------------------------------
// Delete / cancel a scheduled campaign
// ---------------------------------------------------------------------------

router.delete("/:id", async (req: AuthedRequest, res) => {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }
  if (campaign.queueJobId) {
    await cancelCampaignSend(campaign.queueJobId);
  }
  await prisma.campaignRecipient.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.campaign.delete({ where: { id: campaign.id } });
  res.status(204).send();
});

export default router;