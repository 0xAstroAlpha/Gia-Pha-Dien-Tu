import crypto from 'crypto';
import prisma from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import type { CreateInviteDto, UpdateRoleDto, UpdateStatusDto, UpdateProfileDto } from './dto';

export class UserService {
    // === List users ===
    async listUsers(page: number, limit: number) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    displayName: true,
                    role: true,
                    status: true,
                    avatarUrl: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count(),
        ]);

        return { users, total };
    }

    // === Get current user profile ===
    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                status: true,
                avatarUrl: true,
                phone: true,
                createdAt: true,
            },
        });

        if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');
        return user;
    }

    // === Update profile ===
    async updateProfile(userId: string, data: UpdateProfileDto) {
        return prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                avatarUrl: true,
                phone: true,
            },
        });
    }

    // === Update role (Admin only) ===
    async updateRole(targetUserId: string, data: UpdateRoleDto) {
        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');

        return prisma.user.update({
            where: { id: targetUserId },
            data: { role: data.role },
            select: { id: true, email: true, displayName: true, role: true },
        });
    }

    // === Update status (Admin only) ===
    async updateStatus(targetUserId: string, data: UpdateStatusDto) {
        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng');

        // If suspending, invalidate all refresh tokens
        if (data.status === 'SUSPENDED') {
            await prisma.refreshToken.deleteMany({ where: { userId: targetUserId } });
        }

        return prisma.user.update({
            where: { id: targetUserId },
            data: { status: data.status },
            select: { id: true, email: true, displayName: true, status: true },
        });
    }

    // === Create invite link ===
    async createInvite(createdBy: string, data: CreateInviteDto) {
        const code = crypto.randomBytes(16).toString('hex');

        const invite = await prisma.inviteLink.create({
            data: {
                code,
                role: data.role,
                maxUses: data.maxUses,
                expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
                createdBy,
            },
        });

        return {
            ...invite,
            inviteUrl: `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/register?code=${code}`,
        };
    }

    // === List invite links ===
    async listInvites(page: number, limit: number) {
        const skip = (page - 1) * limit;
        const [invites, total] = await Promise.all([
            prisma.inviteLink.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.inviteLink.count(),
        ]);

        return { invites, total };
    }
}

export const userService = new UserService();
