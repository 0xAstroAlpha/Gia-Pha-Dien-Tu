import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './config/logger';
import { errorHandler } from './middleware/error-handler';
import { auditMiddleware } from './middleware/audit.middleware';

// Route modules
import { authRoutes } from './modules/auth/routes';
import { userRoutes } from './modules/user/routes';
import { genealogyRoutes } from './modules/genealogy/routes';
import { mediaRoutes } from './modules/media/routes';
import { auditRoutes } from './modules/audit/routes';
import { backupRoutes } from './modules/backup/routes';

const app = express();

// === Core Middleware ===
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// === Rate Limiting ===
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});
app.use('/api', generalLimiter);

// === Audit Middleware (auto-log mutations) ===
app.use('/api', auditMiddleware);

// === Health Check ===
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
        },
    });
});

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/genealogy', genealogyRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);

// === 404 Handler ===
app.use('/api/*', (_req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
    });
});

// === Error Handler ===
app.use(errorHandler);

// === Start Server ===
const start = async () => {
    try {
        app.listen(config.port, () => {
            logger.info(`🚀 ClanHub API running on port ${config.port}`);
            logger.info(`📖 Health: http://localhost:${config.port}/api/health`);
            logger.info(`🌍 Environment: ${config.nodeEnv}`);
        });
    } catch (error) {
        logger.fatal(error, 'Failed to start server');
        process.exit(1);
    }
};

start();

export default app;
