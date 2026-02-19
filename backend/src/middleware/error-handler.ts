import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'AppError';
    }
}

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    // Zod validation errors
    if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details },
        });
        return;
    }

    // Known application errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: { code: err.code, message: err.message },
        });
        return;
    }

    // Unexpected errors
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
};
