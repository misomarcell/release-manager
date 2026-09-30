import { config } from './config.js';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { closeDatabase, initDatabase } from './db/connection.js';
import { logger } from './utils/logger.js';
import { reloadCache } from './repositories/jellyfin.repository.js';
import { needsSyncOnStartup } from './repositories/sync.repository.js';
import { jellyfinService } from './services/jellyfin.service.js';
import { qbittorrentService } from './services/qbittorrent.service.js';
import authRoutes from './routes/auth.routes.js';
import searchRoutes from './routes/search.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import versionRoutes from './routes/version.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import libraryRoutes from './routes/library.routes.js';
import type { SyncService } from 'shared/sync.models';

const app = express();

app.set('trust proxy', 1);

app.use(
    cors({
        origin: config.rp.origin,
        credentials: true,
    }),
);
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/library', libraryRoutes);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        next(err);
        return;
    }

    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
        res.status(status).json({ error: err instanceof Error ? err.message : 'Bad request' });
        return;
    }

    logger.error('Unhandled request error', {
        method: req.method,
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
});

interface ScheduledSync {
    service: SyncService;
    label: string;
    enabled: boolean;
    cronSchedule: string;
    sync: () => Promise<number>;
}

async function start() {
    await initDatabase();

    await reloadCache();

    scheduleSync({
        service: 'jellyfin',
        label: 'Jellyfin',
        enabled: Boolean(config.jellyfin.url && config.jellyfin.apiKey),
        cronSchedule: config.jellyfin.cronSchedule,
        sync: () => jellyfinService.syncLibrary(),
    });
    scheduleSync({
        service: 'qbittorrent',
        label: 'qBittorrent',
        enabled: Boolean(config.qbittorrent.url),
        cronSchedule: config.qbittorrent.cronSchedule,
        sync: () => qbittorrentService.syncTorrents(),
    });

    const server = app.listen(config.port, () => {
        logger.info(`Backend started`, { port: config.port });
    });

    const shutdown = (signal: string) => {
        console.log(`Received ${signal}, shutting down`);
        cron.getTasks().forEach((task) => void task.stop());
        server.close(() => {
            closeDatabase()
                .catch((err: unknown) => console.error('Failed to close database pool:', err))
                .finally(() => process.exit(0));
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

function scheduleSync({ service, label, enabled, cronSchedule, sync }: ScheduledSync): void {
    if (!enabled) {
        logger.info(`${label} not configured - sync disabled`);
        return;
    }

    needsSyncOnStartup(service)
        .then((shouldSync) => {
            if (shouldSync) {
                sync().catch((err: unknown) =>
                    logger.error(`${label} initial sync failed`, {
                        error: err instanceof Error ? err.message : String(err),
                    }),
                );
            } else {
                logger.info(`${label} startup sync skipped - data is recent`);
            }
        })
        .catch((err: unknown) =>
            logger.error(`${label} startup check failed`, {
                error: err instanceof Error ? err.message : String(err),
            }),
        );

    cron.schedule(cronSchedule, () => {
        sync().catch((err: unknown) =>
            logger.error(`${label} scheduled sync failed`, {
                error: err instanceof Error ? err.message : String(err),
            }),
        );
    });
    logger.info(`${label} sync scheduled`, { schedule: cronSchedule });
}

start().catch((err) => {
    console.error('Failed to start backend:', err);
    process.exit(1);
});
