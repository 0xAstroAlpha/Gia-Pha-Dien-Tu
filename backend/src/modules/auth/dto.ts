import { z } from 'zod';

export const registerDto = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    displayName: z.string().min(2, 'Tên hiển thị tối thiểu 2 ký tự').max(100),
    inviteCode: z.string().min(1, 'Mã mời là bắt buộc'),
});

export const loginDto = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Mật khẩu là bắt buộc'),
});

export const refreshTokenDto = z.object({
    refreshToken: z.string().min(1, 'Refresh token là bắt buộc'),
});

export const forgotPasswordDto = z.object({
    email: z.string().email('Email không hợp lệ'),
});

export const resetPasswordDto = z.object({
    token: z.string().min(1, 'Token là bắt buộc'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

export type RegisterDto = z.infer<typeof registerDto>;
export type LoginDto = z.infer<typeof loginDto>;
export type RefreshTokenDto = z.infer<typeof refreshTokenDto>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordDto>;
export type ResetPasswordDto = z.infer<typeof resetPasswordDto>;
