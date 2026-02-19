import type { Request, Response, NextFunction } from 'express';
import { authService } from './service';
import { registerDto, loginDto, refreshTokenDto, forgotPasswordDto, resetPasswordDto } from './dto';
import { successResponse } from '../../shared/utils/response';

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const data = registerDto.parse(req.body);
            const result = await authService.register(data);
            res.status(201).json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const data = loginDto.parse(req.body);
            const result = await authService.login(data);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = refreshTokenDto.parse(req.body);
            const result = await authService.refresh(refreshToken);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = refreshTokenDto.parse(req.body);
            await authService.logout(refreshToken);
            res.json(successResponse({ message: 'Đăng xuất thành công' }));
        } catch (error) {
            next(error);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { email } = forgotPasswordDto.parse(req.body);
            const result = await authService.forgotPassword(email);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const data = resetPasswordDto.parse(req.body);
            const result = await authService.resetPassword(data.token, data.password);
            res.json(successResponse(result));
        } catch (error) {
            next(error);
        }
    }
}

export const authController = new AuthController();
