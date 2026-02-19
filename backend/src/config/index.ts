import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://clanhub:clanhub_secret@localhost:5432/clanhub',

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    // Gramps Web
    grampsWebUrl: process.env.GRAMPS_WEB_URL || 'http://localhost:5000',

    // S3 / MinIO
    s3: {
        endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
        accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
        bucket: process.env.S3_BUCKET || 'clanhub-media',
        region: process.env.S3_REGION || 'us-east-1',
    },

    // Email
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.resend.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@clanhub.vn',
    },

    // Logging
    logLevel: process.env.LOG_LEVEL || 'debug',
} as const;
