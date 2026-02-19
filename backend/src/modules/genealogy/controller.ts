import type { Request, Response, NextFunction } from 'express';
import { genealogyService } from './service';
import { successResponse } from '../../shared/utils/response';

export class GenealogyController {
    async getPeople(req: Request, res: Response, next: NextFunction) {
        try {
            const people = await genealogyService.getPeople(req.user!.role);
            res.json(successResponse(people));
        } catch (error) {
            next(error);
        }
    }

    async getPerson(req: Request, res: Response, next: NextFunction) {
        try {
            const person = await genealogyService.getPerson(req.params.handle, req.user!.role);
            res.json(successResponse(person));
        } catch (error) {
            next(error);
        }
    }

    async getFamilies(req: Request, res: Response, next: NextFunction) {
        try {
            const families = await genealogyService.getFamilies();
            res.json(successResponse(families));
        } catch (error) {
            next(error);
        }
    }

    async getFamily(req: Request, res: Response, next: NextFunction) {
        try {
            const family = await genealogyService.getFamily(req.params.handle);
            res.json(successResponse(family));
        } catch (error) {
            next(error);
        }
    }

    async getTree(req: Request, res: Response, next: NextFunction) {
        try {
            const tree = await genealogyService.getTree(req.user!.role);
            res.json(successResponse(tree));
        } catch (error) {
            next(error);
        }
    }

    async updatePerson(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await genealogyService.updatePerson(req.params.handle, req.body);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async addPerson(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await genealogyService.addPerson(req.body);
            res.status(201).json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async addFamily(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await genealogyService.addFamily(req.body);
            res.status(201).json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async deletePerson(req: Request, res: Response, next: NextFunction) {
        try {
            await genealogyService.deletePerson(req.params.handle);
            res.json(successResponse({ message: 'Đã xóa' }));
        } catch (error) {
            next(error);
        }
    }
}

export const genealogyController = new GenealogyController();
