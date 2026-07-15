"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAudienceMembers = resolveAudienceMembers;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// ---------------------------------------------------------------------------
// Filter shape
// ---------------------------------------------------------------------------
// {
//   "tag": "vip",                                  // optional, contact must have this tag
//   "fields": [{ "field": "city", "equals": "Mumbai" }]   // optional, AND'd together
// }
// Both are optional; an empty filter matches every contact in the workspace.
const filterSchema = zod_1.z.object({
    tag: zod_1.z.string().optional(),
    fields: zod_1.z
        .array(zod_1.z.object({ field: zod_1.z.string(), equals: zod_1.z.string() }))
        .optional(),
});
const audienceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    filter: filterSchema,
});
// ---------------------------------------------------------------------------
// Shared resolver - also used later by the campaigns route to pull
// recipients when someone sends to "an audience".
// ---------------------------------------------------------------------------
async function resolveAudienceMembers(workspaceId, filter) {
    const contacts = await prisma_1.prisma.contact.findMany({
        where: {
            workspaceId,
            ...(filter.tag && { tags: { some: { tag: { name: filter.tag } } } }),
        },
        include: { tags: { include: { tag: true } } },
    });
    if (!filter.fields || filter.fields.length === 0) {
        return contacts;
    }
    // customFields is a JSON blob with arbitrary keys, so field-equality
    // filtering happens in application code rather than in SQL.
    return contacts.filter((contact) => {
        const cf = (contact.customFields ?? {});
        return filter.fields.every((f) => String(cf[f.field] ?? "").toLowerCase() === f.equals.toLowerCase());
    });
}
// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
    const parsed = audienceSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const audience = await prisma_1.prisma.audience.create({
        data: {
            name: parsed.data.name,
            filter: parsed.data.filter,
            workspaceId: req.workspaceId,
        },
    });
    const members = await resolveAudienceMembers(req.workspaceId, parsed.data.filter);
    res.status(201).json({ ...audience, memberCount: members.length });
});
// ---------------------------------------------------------------------------
// List - includes a live member count for each audience
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
    const audiences = await prisma_1.prisma.audience.findMany({
        where: { workspaceId: req.workspaceId },
        orderBy: { createdAt: "desc" },
    });
    const withCounts = await Promise.all(audiences.map(async (a) => {
        const members = await resolveAudienceMembers(req.workspaceId, a.filter);
        return { ...a, memberCount: members.length };
    }));
    res.json(withCounts);
});
// ---------------------------------------------------------------------------
// Get one - includes the actual member list
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
    const audience = await prisma_1.prisma.audience.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!audience) {
        return res.status(404).json({ error: "Audience not found" });
    }
    const members = await resolveAudienceMembers(req.workspaceId, audience.filter);
    res.json({ ...audience, members, memberCount: members.length });
});
// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
router.patch("/:id", async (req, res) => {
    const parsed = audienceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const existing = await prisma_1.prisma.audience.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        return res.status(404).json({ error: "Audience not found" });
    }
    const updated = await prisma_1.prisma.audience.update({
        where: { id: existing.id },
        data: {
            ...(parsed.data.name !== undefined && { name: parsed.data.name }),
            ...(parsed.data.filter !== undefined && { filter: parsed.data.filter }),
        },
    });
    res.json(updated);
});
// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
    const existing = await prisma_1.prisma.audience.findFirst({
        where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!existing) {
        return res.status(404).json({ error: "Audience not found" });
    }
    await prisma_1.prisma.audience.delete({ where: { id: existing.id } });
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=audiences.js.map