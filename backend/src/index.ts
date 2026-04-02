import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDatabase } from './db/connection.js';
import authRoutes from './routes/auth.routes.js';
import searchRoutes from './routes/search.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import versionRoutes from './routes/version.routes.js';

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await initDatabase();
  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
