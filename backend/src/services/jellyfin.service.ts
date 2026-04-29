import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { MediaType } from 'shared/tmdb.models';
import { replaceLibrary, reloadCache, logSync, type JellyfinItem } from '../repositories/jellyfin.repository.js';

interface JellyfinRawItem {
  Id: string;
  Name: string;
  Type: string;
  ProductionYear?: number;
  DateCreated?: string;
  ProviderIds?: {
    Tmdb?: string;
    [key: string]: string | undefined;
  };
}

function authHeaders(): Record<string, string> {
  return {
    'X-MediaBrowser-Token': config.jellyfin.apiKey,
    Accept: 'application/json',
  };
}

async function jellyfinGet(path: string, params?: Record<string, string>): Promise<unknown> {
  const { url } = config.jellyfin;
  const endpoint = new URL(`${url}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      endpoint.searchParams.set(k, v);
    }
  }

  console.log(`[Jellyfin] GET ${endpoint.pathname}${endpoint.search}`);

  const response = await fetch(endpoint, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Jellyfin responded with ${response.status} for ${path}`);
  }
  return response.json();
}

function mapMediaType(jellyfinType: string): MediaType | null {
  if (jellyfinType === 'Movie') return 'movie';
  if (jellyfinType === 'Series') return 'tv';
  return null;
}

async function syncLibrary(): Promise<number> {
  const { url, apiKey } = config.jellyfin;
  if (!url || !apiKey) {
    throw new Error('Jellyfin is not configured. Set JELLYFIN_URL and JELLYFIN_API_KEY.');
  }

  logger.info('Jellyfin sync started');

  const data = (await jellyfinGet(`/Users/${config.jellyfin.userId}/Items`, {
    Recursive: 'true',
    IncludeItemTypes: 'Movie,Series',
    Fields: 'ProviderIds,Name,ProductionYear,DateCreated',
  })) as { Items?: JellyfinRawItem[] };

  const rawItems: JellyfinRawItem[] = Array.isArray(data?.Items) ? data.Items : [];

  const items: JellyfinItem[] = rawItems
    .map((raw): JellyfinItem | null => {
      const mediaType = mapMediaType(raw.Type);
      if (!mediaType || !raw.Name) return null;

      const tmdbIdRaw = raw.ProviderIds?.['Tmdb'];
      const tmdbId = tmdbIdRaw ? parseInt(tmdbIdRaw, 10) || null : null;
      const year = raw.ProductionYear ? String(raw.ProductionYear) : null;
      const dateCreated = raw.DateCreated ? new Date(raw.DateCreated) : null;

      return { jellyfinId: raw.Id, tmdbId, mediaType, title: raw.Name, year, dateCreated };
    })
    .filter((item): item is JellyfinItem => item !== null);

  await replaceLibrary(items);
  await reloadCache();

  logger.info('Jellyfin sync completed', { itemCount: items.length });
  return items.length;
}

export async function testConnection(): Promise<{ version: string }> {
  const { url, apiKey } = config.jellyfin;
  if (!url || !apiKey) {
    throw new Error('Jellyfin is not configured. Set JELLYFIN_URL and JELLYFIN_API_KEY.');
  }

  const data = (await jellyfinGet('/System/Info/Public')) as { Version?: string; ServerName?: string };
  const version = data?.Version ?? 'unknown';
  return { version };
}

export async function runScheduledSync(): Promise<void> {
  try {
    const itemCount = await syncLibrary();
    await logSync(true, itemCount, null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Jellyfin sync failed', { error: message });
    await logSync(false, null, message);
  }
}
