import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import type {
  NcoreCategoryKey,
  NcoreResult,
  NcoreSearchResponse,
} from '../../shared/src/ncore.models.js';

setGlobalOptions({ maxInstances: 10, region: 'europe-west1' });

const SUPPORTED_CATEGORIES: Record<NcoreCategoryKey, string> = {
  all: 'xvid_hun,xvid,dvd_hun,dvd,dvd9_hun,dvd9,hd_hun,hd,xvidser_hun,xvidser,dvdser_hun,dvdser,hdser_hun,hdser,mp3_hun,mp3,lossless_hun,lossless,clip,game_iso,game_rip,console,iso,misc,mobil,ebook_hun,ebook,xxx_xvid,xxx_dvd,xxx_imageset,xxx_hd',
  movies: 'xvid_hun,xvid,dvd_hun,dvd,dvd9_hun,dvd9,hd_hun,hd',
  tv: 'xvidser_hun,xvidser,dvdser_hun,dvdser,hdser_hun,hdser',
  music: 'mp3_hun,mp3,lossless_hun,lossless,clip',
  games: 'game_iso,game_rip,console',
  software: 'iso,misc,mobil',
  books: 'ebook_hun,ebook',
};

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

function getCategoryKey(value: unknown): NcoreCategoryKey {
  if (typeof value === 'string' && value in SUPPORTED_CATEGORIES) {
    return value as NcoreCategoryKey;
  }

  return 'all';
}

export const ncoreSearch = onRequest(
  {
    cors: true,
    secrets: ['NCORE_COOKIE', 'NCORE_BASE_URL'],
  },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed. Use GET.' });
      return;
    }

    const query = typeof req.query['query'] === 'string' ? req.query['query'].trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Missing query parameter: query' });
      return;
    }

    const categoryKey = getCategoryKey(req.query['category']);
    const category = SUPPORTED_CATEGORIES[categoryKey];

    const baseUrl = process.env['NCORE_BASE_URL']?.trim() || 'https://ncore.pro';
    const cookieHeader = process.env['NCORE_COOKIE']?.trim();

    if (!cookieHeader) {
      res.status(500).json({ error: 'Missing nCore credentials. Set NCORE_COOKIE secret.' });
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
        method: 'GET',
        headers: {
          Cookie: cookieHeader,
          Accept: 'application/json,text/plain,*/*',
        },
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
      const upstreamResults = Array.isArray(parsedBodyRecord['results'])
        ? parsedBodyRecord['results']
        : [];

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

      const responseBody: NcoreSearchResponse = {
        query,
        category: categoryKey,
        requestUrl: searchUrl.toString(),
        data: parsedBody,
        results,
      };

      res.status(200).json(responseBody);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown upstream error';
      res.status(502).json({ error: message });
    }
  },
);
