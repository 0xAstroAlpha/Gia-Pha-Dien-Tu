import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { logger } from '../../config/logger';

interface AuditData {
    action: string;
    entityType: string;
    entityId?: string;
    diffSummary?: Record<string, unknown>;
}

/**
 * Creates an audit log entry asynchronously (fire-and-forget).
 * Used in services after successful mutations.
 */
export const createAuditLog = async (
    actorId: string,
    data: AuditData,
    ipAddress?: string,
) => {
    try {
        await prisma.auditLog.create({
            data: {
                actorId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                diffSummary: data.diffSummary as any,
                ipAddress,
            },
        });
    } catch (error) {
        // Don't let audit failures break the main flow
        logger.error({ error, data }, 'Failed to create audit log');
    }
};

/**
 * Express middleware that auto-logs mutations (POST/PUT/PATCH/DELETE).
 * Runs after response is sent (post-response hook).
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json.bind(res);

    res.json = (body: any) => {
        // Only log mutations on success
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 400 && req.user) {
            const pathParts = req.path.split('/').filter(Boolean);
            const entityType = pathParts[0] || 'unknown';
            const entityId = req.params.id || req.params.handle || pathParts[1];

            createAuditLog(
                req.user.id,
                {
                    action: req.method === 'POST' ? 'CREATE' : req.method === 'DELETE' ? 'DELETE' : 'UPDATE',
                    entityType,
                    entityId,
                },
                req.ip,
            );
        }

        return originalSend(body);
    };

    next();
};
