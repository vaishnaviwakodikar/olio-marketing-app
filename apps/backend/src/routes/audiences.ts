import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Filter shape
// ---------------------------------------------------------------------------
// {
//   "tag": "vip",                                  // optional, contact must have this tag
//   "fields": [{ "field": "city", "equals": "Mumbai" }]   // optional, AND'd together
// }
// Both are optional; an empty filter matches every contact in the workspace.

const filterSchema = z.object({
  tag: z.string().optional(),
  fields: z
    .array(z.object({ field: z.string(), equals: z.string() }))
    .optional(),
});

const audienceSchema = z.object({
  name: z.string().min(1),
  filter: filterSchema,
});

// ---------------------------------------------------------------------------
// Shared resolver - also used later by the campaigns route to pull
// recipients when someone sends to "an audience".
// ---------------------------------------------------------------------------

export async function resolveAudienceMembers(
  workspaceId: string,
  filter: z.infer<typeof filterSchema>
) {
  const contacts = await prisma.contact.findMany({
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
    const cf = (contact.customFields ?? {}) as Record<string, unknown>;
    return filter.fields!.every(
      (f) => String(cf[f.field] ?? "").toLowerCase() === f.equals.toLowerCase()
    );
  });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = audienceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const audience = await prisma.audience.create({
    data: {
      name: parsed.data.name,
      filter: parsed.data.filter,
      workspaceId: req.workspaceId!,
    },
  });

  const members = await resolveAudienceMembers(req.workspaceId!, parsed.data.filter);
  res.status(201).json({ ...audience, memberCount: members.length });
});

// ---------------------------------------------------------------------------
// List - includes a live member count for each audience
// ---------------------------------------------------------------------------

router.get("/", async (req: AuthedRequest, res) => {
  const audiences = await prisma.audience.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  const withCounts = await Promise.all(
    audiences.map(async (a) => {
      const members = await resolveAudienceMembers(
        req.workspaceId!,
        a.filter as z.infer<typeof filterSchema>
      );
      return { ...a, memberCount: members.length };
    })
  );

  res.json(withCounts);
});

// ---------------------------------------------------------------------------
// Get one - includes the actual member list
// ---------------------------------------------------------------------------

router.get("/:id", async (req: AuthedRequest, res) => {
  const audience = await prisma.audience.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!audience) {
    return res.status(404).json({ error: "Audience not found" });
  }

  const members = await resolveAudienceMembers(
    req.workspaceId!,
    audience.filter as z.infer<typeof filterSchema>
  );
  res.json({ ...audience, members, memberCount: members.length });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

router.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = audienceSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.audience.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Audience not found" });
  }

  const updated = await prisma.audience.update({
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

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.audience.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Audience not found" });
  }
  await prisma.audience.delete({ where: { id: existing.id } });
  res.status(204).send();
});

export default router;