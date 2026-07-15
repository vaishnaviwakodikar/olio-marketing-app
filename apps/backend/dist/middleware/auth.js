"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
}
/**
 * Every route that touches workspace-scoped data (contacts, audiences,
 * campaigns...) must sit behind this middleware, and must filter its
 * Prisma queries by `req.workspaceId` - never by a workspaceId taken from
 * the request body/query/params. That's what keeps account A from ever
 * being able to read account B's data, no matter what the client sends.
 */
function requireAuth(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = payload.userId;
        req.workspaceId = payload.workspaceId;
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
}
//# sourceMappingURL=auth.js.map