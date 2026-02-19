import type { Request } from 'express';

export interface PaginationQuery {
    page: number;
    limit: number;
    skip: number;
}

export interface PaginatedResponse<T> {
    success: true;
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const parsePagination = (req: Request): PaginationQuery => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    return { page, limit, skip: (page - 1) * limit };
};

export const paginatedResponse = <T>(
    data: T[],
    total: number,
    pagination: PaginationQuery,
): PaginatedResponse<T> => ({
    success: true,
    data,
    meta: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
    },
});

export const successResponse = <T>(data: T) => ({
    success: true as const,
    data,
});
