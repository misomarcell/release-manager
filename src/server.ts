import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { join } from 'node:path';

type NcoreCategoryKey = 'all' | 'movies' | 'tv' | 'music' | 'games' | 'software' | 'books';

interface NcoreResult {
  name: string;
  size: string;
  seeds: number;
  leech: number;
  link: string;
  desc_link: string;
  engine_url: string;
}

const SUPPORTED_CATEGORIES: Record<NcoreCategoryKey, string> = {
  all: 'xvid_hun,xvid,dvd_hun,dvd,dvd9_hun,dvd9,hd_hun,hd,xvidser_hun,xvidser,dvdser_hun,dvdser,hdser_hun,hdser,mp3_hun,mp3,lossless_hun,lossless,clip,game_iso,game_rip,console,iso,misc,mobil,ebook_hun,ebook,xxx_xvid,xxx_dvd,xxx_imageset,xxx_hd',
  movies: 'xvid_hun,xvid,dvd_hun,dvd,dvd9_hun,dvd9,hd_hun,hd',
  tv: 'xvidser_hun,xvidser,dvdser_hun,dvdser,hdser_hun,hdser',
  music: 'mp3_hun,mp3,lossless_hun,lossless,clip',
  games: 'game_iso,game_rip,console',
  software: 'iso,misc,mobil',
  books: 'ebook_hun,ebook',
};

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function withBaseUrl(value: string, baseUrl: string): string {
  if (!value) {
    return '';
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return new URL(value, baseUrl).toString();
}

function getCategoryKey(input: string): NcoreCategoryKey {
  if (input in SUPPORTED_CATEGORIES) {
    return input as NcoreCategoryKey;
  }

  return 'all';
}

app.get('/api/ncore/search', async (req: Request, res: Response) => {
  const query = (req.query['query'] as string | undefined)?.trim() ?? '';
  if (!query) {
    res.status(400).json({ error: 'Missing query parameter: query' });
    return;
  }

  const categoryKey = getCategoryKey((req.query['category'] as string | undefined) ?? 'all');
  const category = SUPPORTED_CATEGORIES[categoryKey];

  const baseUrl = process.env['NCORE_BASE_URL'] ?? 'https://ncore.pro';
  const cookieHeader = process.env['NCORE_COOKIE']?.trim();

  if (!cookieHeader) {
    res.status(500).json({
      error: 'Missing nCore credentials. Set NCORE_COOKIE environment variable.',
    });
    return;
  }

  const searchUrl = new URL('/torrents.php', baseUrl);
  searchUrl.searchParams.set('kivalasztott_tipus', category);
  searchUrl.searchParams.set('mire', query);
  searchUrl.searchParams.set('miben', 'name');
  searchUrl.searchParams.set('tipus', 'kivalasztottak_kozott');
  searchUrl.searchParams.set('submit.x', '0');
  searchUrl.searchParams.set('submit.y', '0');
  searchUrl.searchParams.set('submit', 'Ok');
  searchUrl.searchParams.set('tags', '');
  searchUrl.searchParams.set('searchedfrompotato', 'qbittorrent');
  searchUrl.searchParams.set('jsons', 'true');

  try {
    const upstreamResponse = await fetch(searchUrl, {
      headers: {
        Cookie: cookieHeader,
        Accept: 'application/json,text/plain,*/*',
      },
      method: 'GET',
    });

    const rawBody = await upstreamResponse.text();
    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        error: 'nCore request failed',
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: rawBody,
      });
      return;
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      res.status(502).json({
        error: 'nCore returned non-JSON content',
        body: rawBody,
      });
      return;
    }

    const parsedBodyRecord = asRecord(parsedBody);
    const upstreamResults = Array.isArray(parsedBodyRecord['results']) ? parsedBodyRecord['results'] : [];

    const results: NcoreResult[] = upstreamResults.map((entry) => {
      const item = asRecord(entry);
      return {
        name: asString(item['release_name']),
        size: asString(item['size']),
        seeds: asNumber(item['seeders']),
        leech: asNumber(item['leechers']),
        link: withBaseUrl(asString(item['download_url']), baseUrl),
        desc_link: withBaseUrl(asString(item['details_url']), baseUrl),
        engine_url: baseUrl,
      };
    });

    res.json({
      query,
      category: categoryKey,
      requestUrl: searchUrl.toString(),
      data: parsedBody,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown upstream error';
    res.status(502).json({ error: message });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
