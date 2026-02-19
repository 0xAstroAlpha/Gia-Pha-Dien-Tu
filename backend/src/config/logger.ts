import pino from 'pino';
import { config } from './index';

export const logger = pino({
    level: config.logLevel,
    transport:
        config.nodeEnv === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
});
