import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';

// Role hierarchy: Admin > Editor > Archivist > Member > Guest
const ROLE_HIERARCHY: Record<Role, number> = {
    ADMIN: 50,
    EDITOR: 40,
    ARCHIVIST: 30,
    MEMBER: 20,
    GUEST: 10,
};

export const requireRole = (minimumRole: Role) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
            });
            return;
        }

        const userLevel = ROLE_HIERARCHY[req.user.role];
        const requiredLevel = ROLE_HIERARCHY[minimumRole];

        if (userLevel < requiredLevel) {
            res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
            });
            return;
        }

        next();
    };
};
