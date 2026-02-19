import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';

export interface AuthUser {
    id: string;
    email: string;
    role: Role;
    displayName: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
            return;
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, role: true, displayName: true, status: true },
        });

        if (!user || user.status !== 'ACTIVE') {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found or suspended' } });
            return;
        }

        req.user = { id: user.id, email: user.email, role: user.role, displayName: user.displayName };
        next();
    } catch {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
};
