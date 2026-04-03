import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  databaseUrl:
    process.env['DATABASE_URL'] ?? 'postgres://movieapp:movieapp@localhost:5432/movieapp',
  ncore: {
    baseUrl: process.env['NCORE_BASE_URL']?.trim() || 'https://ncore.pro',
    username: process.env['NCORE_USERNAME']?.trim() || '',
    cookiePass: process.env['NCORE_COOKIE_PASS']?.trim() || '',
  },
  tmdb: {
    accessToken: process.env['TMDB_ACCESS_TOKEN']?.trim() || '',
  },
  github: {
    repo: process.env['GITHUB_REPO']?.trim() || 'misomarcell/release-manager',
    token: process.env['GITHUB_TOKEN']?.trim() || '',
  },
  rp: {
    id: process.env['RP_ID'] ?? 'localhost',
    name: 'MovieReleases',
    origin: (process.env['RP_ORIGIN'] ?? 'http://localhost:4000,http://localhost:4200')
      .split(',')
      .map((o) => o.trim()),
  },
  qbittorrent: {
    url: process.env['QBITTORRENT_URL']?.trim() || '',
    username: process.env['QBITTORRENT_USERNAME']?.trim() || 'admin',
    password: process.env['QBITTORRENT_PASSWORD']?.trim() || '',
    savePathMovies: process.env['DOWNLOAD_PATH_MOVIES']?.trim() || '/media/Movies',
    savePathTv: process.env['DOWNLOAD_PATH_TV']?.trim() || '/media/TV_Shows',
  },
  cacheExpiryMs: 7 * 24 * 60 * 60 * 1000, // 1 week
};
