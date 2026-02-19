import { Router } from 'express';
import { authController } from './controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' } },
});

router.post('/register', authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

export const authRoutes = router;
