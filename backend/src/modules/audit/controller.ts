import type { Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { successResponse, parsePagination, paginatedResponse } from '../../shared/utils/response';

export class AuditController {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit, skip } = parsePagination(req);
            const filters: any = {};

            if (req.query.actorId) filters.actorId = req.query.actorId;
            if (req.query.action) filters.action = req.query.action;
            if (req.query.entityType) filters.entityType = req.query.entityType;

            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    where: filters,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { actor: { select: { id: true, displayName: true } } },
                }),
                prisma.auditLog.count({ where: filters }),
            ]);

            res.json(paginatedResponse(logs, total, { page, limit, skip }));
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const log = await prisma.auditLog.findUnique({
                where: { id: req.params.id },
                include: { actor: { select: { id: true, displayName: true } } },
            });
            if (!log) {
                res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Không tìm thấy' } });
                return;
            }
            res.json(successResponse(log));
        } catch (error) {
            next(error);
        }
    }
}

export const auditController = new AuditController();
