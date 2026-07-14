import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export interface AuthedRequest extends Request {
  userId?: string;
  workspaceId?: string;
}

interface TokenPayload {
  userId: string;
  workspaceId: string;
}

/**
 * Every route that touches workspace-scoped data (contacts, audiences,
 * campaigns...) must sit behind this middleware, and must filter its
 * Prisma queries by `req.workspaceId` - never by a workspaceId taken from
 * the request body/query/params. That's what keeps account A from ever
 * being able to read account B's data, no matter what the client sends.
 */
export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
    req.userId = payload.userId;
    req.workspaceId = payload.workspaceId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}