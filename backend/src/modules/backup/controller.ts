import type { Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import prisma from '../../config/database';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/error-handler';
import { successResponse, parsePagination, paginatedResponse } from '../../shared/utils/response';

const execAsync = promisify(exec);

export class BackupController {
    // === Trigger backup ===
    async createBackup(req: Request, res: Response, next: NextFunction) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `clanhub-backup-${timestamp}.sql`;
            const filePath = path.join('/tmp', fileName);

            // pg_dump
            await execAsync(
                `pg_dump "${config.databaseUrl}" --format=plain --file="${filePath}"`,
            );

            const stats = await fs.stat(filePath);

            // Record in DB
            const record = await prisma.backupRecord.create({
                data: {
                    type: 'DB_DUMP',
                    fileName,
                    fileSize: Number(stats.size),
                    storagePath: filePath,
                    initiatedBy: req.user!.id,
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });

            res.status(201).json(successResponse(record));
        } catch (error) {
            logger.error(error, 'Backup failed');
            next(error instanceof AppError ? error : new AppError(500, 'BACKUP_FAILED', 'Backup thất bại'));
        }
    }

    // === List backups ===
    async listBackups(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit, skip } = parsePagination(req);
            const [records, total] = await Promise.all([
                prisma.backupRecord.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.backupRecord.count(),
            ]);

            res.json(paginatedResponse(records, total, { page, limit, skip }));
        } catch (error) {
            next(error);
        }
    }

    // === Download backup ===
    async downloadBackup(req: Request, res: Response, next: NextFunction) {
        try {
            const record = await prisma.backupRecord.findUnique({ where: { id: req.params.id } });
            if (!record) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy backup');

            const exists = await fs.access(record.storagePath).then(() => true).catch(() => false);
            if (!exists) throw new AppError(404, 'FILE_MISSING', 'File backup không còn tồn tại');

            res.download(record.storagePath, record.fileName);
        } catch (error) {
            next(error);
        }
    }
}

export const backupController = new BackupController();
