"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sync_1 = require("csv-parse/sync");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });

router.use(auth_1.requireAuth);
// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
    const contacts = await prisma_1.prisma.contact.findMany({
        where: { workspaceId: req.workspaceId },
        include: { tags: { include: { tag: true } } },
        orderBy: { createdAt: "desc" },
    });
    res.json(contacts);
});
// ---------------------------------------------------------------------------
// Create (manual add) - same dedup check the CSV importer uses
// ---------------------------------------------------------------------------
const contactSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal("")),
    phone: zod_1.z.string().optional(),
    customFields: zod_1.z.record(zod_1.z.any()).optional(),
});
router.post("/", async (req, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { name, email, phone, customFields } = parsed.data;
    const workspaceId = req.workspaceId;
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
    const contact = await prisma_1.prisma.contact.create({
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
router.patch("/:id", async (req, res) => {
    const parsed = contactSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    
    const existing = await prisma_1.prisma.contact.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        return res.status(404).json({ error: "Contact not found" });
    }
    const { name, email, phone, customFields } = parsed.data;
    if (email || phone) {
        const duplicate = await findDuplicate(req.workspaceId, email ?? existing.email ?? undefined, phone ?? existing.phone ?? undefined, existing.id // exclude itself from the dupe check
        );
        if (duplicate) {
            return res.status(409).json({
                error: "Another contact already has this email or phone",
                existingContactId: duplicate.id,
            });
        }
    }
    const updated = await prisma_1.prisma.contact.update({
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
router.delete("/:id", async (req, res) => {
    const existing = await prisma_1.prisma.contact.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        return res.status(404).json({ error: "Contact not found" });
    }
    await prisma_1.prisma.contact.delete({ where: { id: existing.id } });
    res.status(204).send();
});
// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------
router.post("/import", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    const workspaceId = req.workspaceId;
    let rows;
    try {
        rows = (0, sync_1.parse)(req.file.buffer, {
            columns: (header) => header.map((h) => h.trim().toLowerCase()),
            skip_empty_lines: true,
            trim: true,
        });
    }
    catch {
        return res.status(400).json({ error: "Could not parse CSV file" });
    }
    const existingContacts = await prisma_1.prisma.contact.findMany({
        where: { workspaceId },
        select: { email: true, phone: true },
    });
    const seenEmails = new Set(existingContacts
        .filter((c) => c.email)
        .map((c) => c.email.toLowerCase()));
    const seenPhones = new Set(existingContacts
        .filter((c) => c.phone)
        .map((c) => c.phone));
    const toCreate = [];
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
        const isDup = (email && seenEmails.has(email)) || (phone && seenPhones.has(phone));
        if (isDup) {
            skipped++;
            continue;
        }
        
        const { name: _n, email: _e, phone: _p, ...rest } = row;
        toCreate.push({ name, email, phone, customFields: rest });
        
        if (email)
            seenEmails.add(email);
        if (phone)
            seenPhones.add(phone);
    }
    if (toCreate.length > 0) {
        await prisma_1.prisma.contact.createMany({
            data: toCreate.map((c) => ({
                ...c,
                workspaceId,
                customFields: c.customFields,
            })),
        });
    }
    res.json({
        added: toCreate.length,
        skippedDuplicates: skipped,
        skippedInvalid: invalid,
        summary: `${toCreate.length} added, ${skipped} skipped as duplicates${invalid ? `, ${invalid} skipped (missing email and phone)` : ""}`,
    });
});
// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function findDuplicate(workspaceId, email, phone, excludeId) {
    if (!email && !phone)
        return null;
    return prisma_1.prisma.contact.findFirst({
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
exports.default = router;
