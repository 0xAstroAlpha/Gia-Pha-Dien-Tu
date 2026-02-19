import { z } from 'zod';

export const createInviteDto = z.object({
    role: z.enum(['ADMIN', 'EDITOR', 'ARCHIVIST', 'MEMBER', 'GUEST']).default('MEMBER'),
    maxUses: z.number().int().min(1).max(100).default(1),
    expiresAt: z.string().datetime().optional(),
});

export const updateRoleDto = z.object({
    role: z.enum(['ADMIN', 'EDITOR', 'ARCHIVIST', 'MEMBER', 'GUEST']),
});

export const updateStatusDto = z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const updateProfileDto = z.object({
    displayName: z.string().min(2).max(100).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
});

export type CreateInviteDto = z.infer<typeof createInviteDto>;
export type UpdateRoleDto = z.infer<typeof updateRoleDto>;
export type UpdateStatusDto = z.infer<typeof updateStatusDto>;
export type UpdateProfileDto = z.infer<typeof updateProfileDto>;
