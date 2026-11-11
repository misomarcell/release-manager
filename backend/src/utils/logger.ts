import { query } from '../db/connection.js';

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
        console.error(prefix, context ?? '');
    } else if (level === 'warn') {
        console.warn(prefix, context ?? '');
    } else {
        console.log(prefix, context ?? '');
    }
    query('INSERT INTO logs (level, message, context) VALUES ($1, $2, $3)', [level, message, context ?? null]).catch(
        (err) => {
            console.error('[Logger] Failed to write log to DB:', err);
        },
    );
}

export const logger = {
    info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
};
