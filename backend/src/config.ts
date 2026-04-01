import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  databaseUrl:
    process.env['DATABASE_URL'] ?? 'postgres://movieapp:movieapp@localhost:5432/movieapp',
  sessionSecret: process.env['SESSION_SECRET'] ?? 'change-me',
  ncore: {
    baseUrl: process.env['NCORE_BASE_URL']?.trim() || 'https://ncore.pro',
    username: process.env['NCORE_USERNAME']?.trim() || '',
    cookiePass: process.env['NCORE_COOKIE_PASS']?.trim() || '',
  },
  omdb: {
    apiKey: process.env['OMDB_API_KEY']?.trim() || '',
  },
  github: {
    repo: process.env['GITHUB_REPO']?.trim() || 'misomarcell/movie-releases',
    token: process.env['GITHUB_TOKEN']?.trim() || '',
  },
  rp: {
    id: process.env['RP_ID'] ?? 'localhost',
    name: 'MovieReleases',
    origin: (process.env['RP_ORIGIN'] ?? 'http://localhost:4000,http://localhost:4200')
      .split(',')
      .map((o) => o.trim()),
  },
  cacheExpiryMs: 7 * 24 * 60 * 60 * 1000, // 1 week
};
