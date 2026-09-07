import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is required'); // no hardcoded fallback

export type Role = 'admin' | 'member' | 'viewer';
export interface AuthUser {
  userId: string;
  orgId: string;
  role: Role;
}

export function signToken(u: AuthUser): string {
  return jwt.sign(u, secret!, { expiresIn: '1h' });
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'missing token' });
    return;
  }
  try {
    const p = jwt.verify(token, secret!) as jwt.JwtPayload & AuthUser;
    req.user = { userId: p.userId, orgId: p.orgId, role: p.role };
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}
