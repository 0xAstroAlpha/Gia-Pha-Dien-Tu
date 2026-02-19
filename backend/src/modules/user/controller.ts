import type { Request, Response, NextFunction } from 'express';
import { userService } from './service';
import { createInviteDto, updateRoleDto, updateStatusDto, updateProfileDto } from './dto';
import { successResponse, parsePagination, paginatedResponse } from '../../shared/utils/response';

export class UserController {
    async listUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit } = parsePagination(req);
            const { users, total } = await userService.listUsers(page, limit);
            res.json(paginatedResponse(users, total, { page, limit, skip: (page - 1) * limit }));
        } catch (error) {
            next(error);
        }
    }

    async getProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await userService.getProfile(req.user!.id);
            res.json(successResponse(user));
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req: Request, res: Response, next: NextFunction) {
        try {
            const data = updateProfileDto.parse(req.body);
            const user = await userService.updateProfile(req.user!.id, data);
            res.json(successResponse(user));
        } catch (error) {
            next(error);
        }
    }

    async updateRole(req: Request, res: Response, next: NextFunction) {
        try {
            const data = updateRoleDto.parse(req.body);
            const user = await userService.updateRole(req.params.id, data);
            res.json(successResponse(user));
        } catch (error) {
            next(error);
        }
    }

    async updateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const data = updateStatusDto.parse(req.body);
            const user = await userService.updateStatus(req.params.id, data);
            res.json(successResponse(user));
        } catch (error) {
            next(error);
        }
    }

    async createInvite(req: Request, res: Response, next: NextFunction) {
        try {
            const data = createInviteDto.parse(req.body);
            const invite = await userService.createInvite(req.user!.id, data);
            res.status(201).json(successResponse(invite));
        } catch (error) {
            next(error);
        }
    }

    async listInvites(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit } = parsePagination(req);
            const { invites, total } = await userService.listInvites(page, limit);
            res.json(paginatedResponse(invites, total, { page, limit, skip: (page - 1) * limit }));
        } catch (error) {
            next(error);
        }
    }
}

export const userController = new UserController();
