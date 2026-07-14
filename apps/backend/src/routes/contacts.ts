import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Every route below sits behind requireAuth, and every query filters by
// req.workspaceId - that's what keeps this workspace-scoped.
router.use(requireAuth);

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

router.get("/", async (req: AuthedRequest, res) => {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: req.workspaceId },
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(contacts);
});

// ---------------------------------------------------------------------------
// Create (manual add) - same dedup check the CSV importer uses
// ---------------------------------------------------------------------------

const contactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, email, phone, customFields } = parsed.data;
  const workspaceId = req.workspaceId!;

  if (!email && !phone) {
    return res.status(400).json({ error: "Provide at least an email or phone" });
  }

  const duplicate = await findDuplicate(workspaceId, email, phone);
  if (duplicate) {
    return res.status(409).json({
      error: "A contact with this email or phone already exists",
      existingContactId: duplicate.id,
    });
  }

  const contact = await prisma.contact.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      customFields: customFields ?? {},
      workspaceId,
    },
  });
  res.status(201).json(contact);
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

router.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  // Ownership check: fetch scoped by workspaceId so a stolen/guessed id
  // from another workspace can never be edited here.
  const existing = await prisma.contact.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const { name, email, phone, customFields } = parsed.data;

  if (email || phone) {
    const duplicate = await findDuplicate(
      req.workspaceId!,
      email ?? existing.email ?? undefined,
      phone ?? existing.phone ?? undefined,
      existing.id // exclude itself from the dupe check
    );
    if (duplicate) {
      return res.status(409).json({
        error: "Another contact already has this email or phone",
        existingContactId: duplicate.id,
      });
    }
  }

  const updated = await prisma.contact.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(customFields !== undefined && { customFields }),
    },
  });
  res.json(updated);
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.contact.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Contact not found" });
  }
  await prisma.contact.delete({ where: { id: existing.id } });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

router.post("/import", upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const workspaceId = req.workspaceId!;

  let rows: Record<string, string>[];
  try {
    rows = parse(req.file.buffer, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return res.status(400).json({ error: "Could not parse CSV file" });
  }

  const existingContacts = await prisma.contact.findMany({
    where: { workspaceId },
    select: { email: true, phone: true },
  });
  const seenEmails = new Set(
    existingContacts.filter((c) => c.email).map((c) => c.email!.toLowerCase())
  );
  const seenPhones = new Set(
    existingContacts.filter((c) => c.phone).map((c) => c.phone!)
  );

  const toCreate: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    customFields: Record<string, unknown>;
  }[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() || undefined;
    const phone = row.phone?.trim() || undefined;
    const name = row.name?.trim() || undefined;

    if (!email && !phone) {
      invalid++;
      continue;
    }

    const isDup =
      (email && seenEmails.has(email)) || (phone && seenPhones.has(phone));
    if (isDup) {
      skipped++;
      continue;
    }

    // Anything beyond name/email/phone becomes a custom field automatically.
    const { name: _n, email: _e, phone: _p, ...rest } = row;
    toCreate.push({ name, email, phone, customFields: rest });

    // Mark as seen immediately so duplicates *within the same file* are
    // also caught, not just duplicates against the existing DB.
    if (email) seenEmails.add(email);
    if (phone) seenPhones.add(phone);
  }

  if (toCreate.length > 0) {
    await prisma.contact.createMany({
      data: toCreate.map((c) => ({ ...c, workspaceId })),
    });
  }

  res.json({
    added: toCreate.length,
    skippedDuplicates: skipped,
    skippedInvalid: invalid,
    summary: `${toCreate.length} added, ${skipped} skipped as duplicates${
      invalid ? `, ${invalid} skipped (missing email and phone)` : ""
    }`,
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function findDuplicate(
  workspaceId: string,
  email?: string,
  phone?: string,
  excludeId?: string
) {
  if (!email && !phone) return null;
  return prisma.contact.findFirst({
    where: {
      workspaceId,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
}

export default router;