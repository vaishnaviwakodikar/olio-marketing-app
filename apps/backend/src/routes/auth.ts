import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = "token";
const isProd = process.env.NODE_ENV === "production";

const signupSchema = z.object({
  workspaceName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { workspaceName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Workspace + first user created together in one transaction so we never
  // end up with a workspace that has no owner or a user with no workspace.
  const { user, workspace } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const workspace = await tx.workspace.create({
      data: { name: workspaceName },
    });
    const user = await tx.user.create({
      data: { email, passwordHash, workspaceId: workspace.id },
    });
    return { user, workspace };
  });

  issueSession(res, user.id, workspace.id);
  res.status(201).json({ id: user.id, email: user.email });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  issueSession(res, user.id, user.workspaceId);
  res.json({ id: user.id, email: user.email });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.status(204).send();
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const workspaceId = req.workspaceId!;

  const [user, contactCount, campaignCount, sentCampaignCount] =
    await prisma.$transaction([
      prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          workspaceId: true,
          createdAt: true,
          workspace: { select: { name: true, createdAt: true } },
        },
      }),
      prisma.contact.count({ where: { workspaceId } }),
      prisma.campaign.count({ where: { workspaceId } }),
      prisma.campaign.count({ where: { workspaceId, status: "SENT" } }),
    ]);

  res.json({
    ...user,
    stats: {
      contacts: contactCount,
      campaigns: campaignCount,
      campaignsSent: sentCampaignCount,
    },
  });
});

function issueSession(res: any, userId: string, workspaceId: string) {
  const token = jwt.sign({ userId, workspaceId }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.patch("/me/password", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(400).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  res.status(204).send();
});

const renameWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

router.patch("/workspace", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = renameWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const workspace = await prisma.workspace.update({
    where: { id: req.workspaceId },
    data: { name: parsed.data.name },
  });

  res.json({ name: workspace.name });
});

export default router;