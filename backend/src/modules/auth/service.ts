import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/error-handler';
import type { RegisterDto, LoginDto } from './dto';

export class AuthService {
    // === Register via Invite Code ===
    async register(data: RegisterDto) {
        // Validate invite code
        const invite = await prisma.inviteLink.findUnique({
            where: { code: data.inviteCode },
        });

        if (!invite) {
            throw new AppError(400, 'INVALID_INVITE', 'Mã mời không hợp lệ');
        }

        if (invite.expiresAt && invite.expiresAt < new Date()) {
            throw new AppError(400, 'INVITE_EXPIRED', 'Mã mời đã hết hạn');
        }

        if (invite.usedCount >= invite.maxUses) {
            throw new AppError(400, 'INVITE_EXHAUSTED', 'Mã mời đã được sử dụng hết');
        }

        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email: data.email } });
        if (existing) {
            throw new AppError(409, 'EMAIL_EXISTS', 'Email đã được đăng ký');
        }

        // Hash password
        const passwordHash = await argon2.hash(data.password);

        // Create user + update invite count in transaction
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email: data.email,
                    passwordHash,
                    displayName: data.displayName,
                    role: invite.role,
                    invitedBy: invite.createdBy,
                },
            });

            await tx.inviteLink.update({
                where: { id: invite.id },
                data: { usedCount: { increment: 1 } },
            });

            return newUser;
        });

        // Generate tokens
        const tokens = this.generateTokens(user.id);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return {
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
            ...tokens,
        };
    }

    // === Login ===
    async login(data: LoginDto) {
        const user = await prisma.user.findUnique({ where: { email: data.email } });

        if (!user) {
            throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
        }

        if (user.status !== 'ACTIVE') {
            throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đã bị tạm ngưng');
        }

        const validPassword = await argon2.verify(user.passwordHash, data.password);
        if (!validPassword) {
            throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
        }

        const tokens = this.generateTokens(user.id);
        await this.saveRefreshToken(user.id, tokens.refreshToken);

        return {
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
            ...tokens,
        };
    }

    // === Refresh Token ===
    async refresh(refreshToken: string) {
        const stored = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!stored || stored.expiresAt < new Date()) {
            // Delete expired token if found
            if (stored) {
                await prisma.refreshToken.delete({ where: { id: stored.id } });
            }
            throw new AppError(401, 'INVALID_REFRESH', 'Refresh token không hợp lệ hoặc đã hết hạn');
        }

        if (stored.user.status !== 'ACTIVE') {
            throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Tài khoản đã bị tạm ngưng');
        }

        // Rotate: delete old, create new
        await prisma.refreshToken.delete({ where: { id: stored.id } });

        const tokens = this.generateTokens(stored.userId);
        await this.saveRefreshToken(stored.userId, tokens.refreshToken);

        return {
            user: {
                id: stored.user.id,
                email: stored.user.email,
                displayName: stored.user.displayName,
                role: stored.user.role,
            },
            ...tokens,
        };
    }

    // === Logout ===
    async logout(refreshToken: string) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    // === Forgot Password (generate reset token) ===
    async forgotPassword(email: string) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Don't reveal if email exists
            return { message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu' };
        }

        // Generate reset token (stored as a refresh token with short expiry)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await argon2.hash(resetToken);

        // Store hashed token (reuse RefreshToken model with 1h expiry)
        await prisma.refreshToken.create({
            data: {
                token: `reset:${hashedToken}`,
                userId: user.id,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            },
        });

        // TODO: Send email with reset link (Story 1.3)
        // await sendResetEmail(user.email, resetToken);

        return { message: 'Nếu email tồn tại, bạn sẽ nhận được link đặt lại mật khẩu', _devToken: resetToken };
    }

    // === Reset Password ===
    async resetPassword(token: string, newPassword: string) {
        // Find valid reset tokens
        const resetTokens = await prisma.refreshToken.findMany({
            where: {
                token: { startsWith: 'reset:' },
                expiresAt: { gt: new Date() },
            },
        });

        let matchedToken = null;
        for (const rt of resetTokens) {
            const hash = rt.token.replace('reset:', '');
            const valid = await argon2.verify(hash, token);
            if (valid) {
                matchedToken = rt;
                break;
            }
        }

        if (!matchedToken) {
            throw new AppError(400, 'INVALID_RESET_TOKEN', 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
        }

        const passwordHash = await argon2.hash(newPassword);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: matchedToken.userId },
                data: { passwordHash },
            }),
            prisma.refreshToken.delete({ where: { id: matchedToken.id } }),
            // Invalidate all refresh tokens for this user (force re-login)
            prisma.refreshToken.deleteMany({ where: { userId: matchedToken.userId } }),
        ]);

        return { message: 'Mật khẩu đã được đặt lại thành công' };
    }

    // === Helper: Generate JWT tokens ===
    private generateTokens(userId: string) {
        const accessToken = jwt.sign({ userId }, config.jwt.secret, {
            expiresIn: config.jwt.accessExpiresIn,
        } as jwt.SignOptions);

        const refreshToken = crypto.randomBytes(40).toString('hex');

        return { accessToken, refreshToken };
    }

    // === Helper: Save refresh token to DB ===
    private async saveRefreshToken(userId: string, token: string) {
        await prisma.refreshToken.create({
            data: {
                token,
                userId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });
    }
}

export const authService = new AuthService();
