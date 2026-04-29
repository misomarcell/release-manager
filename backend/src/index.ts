import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { initDatabase } from './db/connection.js';
import { logger } from './utils/logger.js';
import { reloadCache, needsSyncOnStartup } from './repositories/jellyfin.repository.js';
import { runScheduledSync } from './services/jellyfin.service.js';
import authRoutes from './routes/auth.routes.js';
import searchRoutes from './routes/search.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import versionRoutes from './routes/version.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import libraryRoutes from './routes/library.routes.js';

const app = express();

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

async function start() {
  await initDatabase();

  await reloadCache();
  if (config.jellyfin.url && config.jellyfin.apiKey) {
    needsSyncOnStartup()
      .then((shouldSync) => {
        if (shouldSync) {
          runScheduledSync().catch((err: unknown) =>
            logger.error('Jellyfin initial sync failed', { error: err instanceof Error ? err.message : String(err) }),
          );
        } else {
          logger.info('Jellyfin startup sync skipped — data is recent');
        }
      })
      .catch((err: unknown) =>
        logger.error('Jellyfin startup check failed', { error: err instanceof Error ? err.message : String(err) }),
      );
    cron.schedule(config.jellyfin.cronSchedule, () => {
      runScheduledSync().catch((err: unknown) =>
        logger.error('Jellyfin scheduled sync failed', { error: err instanceof Error ? err.message : String(err) }),
      );
    });
    logger.info('Jellyfin sync scheduled', { schedule: config.jellyfin.cronSchedule });
  } else {
    logger.info('Jellyfin not configured — library sync disabled');
  }

  app.listen(config.port, () => {
    logger.info(`Backend started`, { port: config.port });
  });
}

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
