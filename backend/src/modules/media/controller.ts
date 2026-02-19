import type { Request, Response, NextFunction } from 'express';
import { mediaService } from './service';
import { uploadMediaDto } from './dto';
import { successResponse, parsePagination, paginatedResponse } from '../../shared/utils/response';

export class MediaController {
    async upload(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'File là bắt buộc' } });
                return;
            }
            const metadata = uploadMediaDto.parse(req.body);
            const media = await mediaService.upload(req.file, metadata, req.user!.id);
            res.status(201).json(successResponse(media));
        } catch (error) {
            next(error);
        }
    }

    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit } = parsePagination(req);
            const filters = {
                state: req.query.state as string | undefined,
                linkedPersonId: req.query.linkedPersonId as string | undefined,
            };
            const { items, total } = await mediaService.list(filters, page, limit);
            res.json(paginatedResponse(items, total, { page, limit, skip: (page - 1) * limit }));
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const media = await mediaService.getById(req.params.id);
            res.json(successResponse(media));
        } catch (error) {
            next(error);
        }
    }

    async approve(req: Request, res: Response, next: NextFunction) {
        try {
            const media = await mediaService.approve(req.params.id, req.user!.id);
            res.json(successResponse(media));
        } catch (error) {
            next(error);
        }
    }

    async reject(req: Request, res: Response, next: NextFunction) {
        try {
            const media = await mediaService.reject(req.params.id, req.user!.id);
            res.json(successResponse(media));
        } catch (error) {
            next(error);
        }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await mediaService.delete(req.params.id);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }
}

export const mediaController = new MediaController();
