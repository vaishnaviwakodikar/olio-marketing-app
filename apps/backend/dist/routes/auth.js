"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "token";
const isProd = process.env.NODE_ENV === "production";
const signupSchema = zod_1.z.object({
    workspaceName: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
});
router.post("/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { workspaceName, email, password } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: "Email already in use" });
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    // Workspace + first user created together in one transaction so we never
    // end up with a workspace that has no owner or a user with no workspace.
    const { user, workspace } = await prisma_1.prisma.$transaction(async (tx) => {
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
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
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
router.get("/me", auth_1.requireAuth, async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, workspaceId: true },
    });
    res.json(user);
});
function issueSession(res, userId, workspaceId) {
    const token = jsonwebtoken_1.default.sign({ userId, workspaceId }, JWT_SECRET, {
        expiresIn: "7d",
    });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
exports.default = router;
//# sourceMappingURL=auth.js.map