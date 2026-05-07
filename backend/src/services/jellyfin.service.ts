import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { MediaType } from 'shared/tmdb.models';
import type { MediaInfo, MediaStream } from 'shared/jellyfin.models';
import { replaceLibrary, reloadCache, type JellyfinItem } from '../repositories/jellyfin.repository.js';
import { logSync } from '../repositories/sync.repository.js';

interface JellyfinRawMediaStream {
    Type: 'Video' | 'Audio' | 'Subtitle';
    Codec?: string;
    Language?: string;
    DisplayTitle?: string;
    VideoRangeType?: string;
    VideoDoViTitle?: string;
    Channels?: number;
    AudioSpatialFormat?: string;
    Profile?: string;
    Width?: number;
}

interface JellyfinRawMediaSource {
    MediaStreams?: JellyfinRawMediaStream[];
    Size?: number;
}

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
    MediaSources?: JellyfinRawMediaSource[];
    Path?: string;
}

interface JellyfinConnectionConfig {
    url: string;
    apiKey: string;
    userId: string;
}

class JellyfinService {
    async testConnection(): Promise<{ version: string }> {
        this.getRequiredConfig();

        const data = (await this.jellyfinGet('/System/Info/Public')) as { Version?: string };
        const version = data.Version ?? 'unknown';
        return { version };
    }

    async syncLibrary(): Promise<number> {
        try {
            const { userId } = this.getRequiredConfig();

            logger.info('Jellyfin sync started');

            const data = (await this.jellyfinGet(`/Users/${userId}/Items`, {
                Recursive: 'true',
                IncludeItemTypes: 'Movie,Series',
                Fields: 'ProviderIds,Name,ProductionYear,DateCreated,MediaSources,Path',
            })) as { Items?: JellyfinRawItem[] };

            const rawItems: JellyfinRawItem[] = Array.isArray(data.Items) ? data.Items : [];
            const items = rawItems
                .map((raw) => this.toJellyfinItem(raw))
                .filter((item): item is JellyfinItem => item !== null);

            await replaceLibrary(items);
            await reloadCache();

            logger.info('Jellyfin sync completed', { itemCount: items.length });
            await logSync('jellyfin', true, items.length, null);

            return items.length;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('Jellyfin sync failed', { error: message });
            await logSync('jellyfin', false, null, message);
            throw error;
        }
    }

    private toJellyfinItem(raw: JellyfinRawItem): JellyfinItem | null {
        const mediaType = this.mapMediaType(raw.Type);
        if (!mediaType || !raw.Name) return null;

        const tmdbIdRaw = raw.ProviderIds?.['Tmdb'];
        const tmdbId = tmdbIdRaw ? parseInt(tmdbIdRaw, 10) || null : null;
        const year = raw.ProductionYear ? String(raw.ProductionYear) : null;
        const dateCreated = raw.DateCreated ? new Date(raw.DateCreated) : null;
        const mediaInfo = this.parseMediaInfo(raw.MediaSources);
        const sizeBytes = raw.MediaSources?.[0]?.Size ?? null;

        return {
            jellyfinId: raw.Id,
            tmdbId,
            mediaType,
            title: raw.Name,
            year,
            dateCreated,
            mediaInfo,
            sizeBytes,
            path: raw.Path ?? null,
        };
    }

    private parseMediaInfo(mediaSources: JellyfinRawMediaSource[] | undefined): MediaInfo | null {
        const streams = mediaSources?.[0]?.MediaStreams;
        if (!streams?.length) return null;

        const mapped = streams
            .filter((s) => s.Type === 'Video' || s.Type === 'Audio' || s.Type === 'Subtitle')
            .map((s): MediaStream => {
                const base: MediaStream = {
                    type: s.Type === 'Video' ? 'video' : s.Type === 'Audio' ? 'audio' : 'subtitle',
                    codec: s.Codec ?? '',
                    language: s.Language ?? '',
                    displayTitle: s.DisplayTitle ?? '',
                };
                if (s.Type === 'Video') {
                    base.width = s.Width;
                    base.videoRangeType = s.VideoRangeType;
                    base.videoDoViTitle = s.VideoDoViTitle;
                }
                if (s.Type === 'Audio') {
                    base.spatialFormat = s.AudioSpatialFormat;
                    base.profile = s.Profile;
                }
                return base;
            });

        return mapped.length ? { streams: mapped } : null;
    }

    private async jellyfinGet(path: string, params?: Record<string, string>): Promise<unknown> {
        const { url } = this.getRequiredConfig();
        const endpoint = new URL(path, url);
        for (const [key, value] of Object.entries(params ?? {})) {
            endpoint.searchParams.set(key, value);
        }

        console.log(`[Jellyfin] GET ${endpoint.pathname}${endpoint.search}`);

        const response = await fetch(endpoint, { headers: this.authHeaders() });
        if (!response.ok) {
            throw new Error(`Jellyfin responded with ${response.status} for ${path}`);
        }

        return response.json();
    }

    private authHeaders(): Record<string, string> {
        return {
            'X-MediaBrowser-Token': config.jellyfin.apiKey,
            Accept: 'application/json',
        };
    }

    private mapMediaType(jellyfinType: string): MediaType | null {
        if (jellyfinType === 'Movie') return 'movie';
        if (jellyfinType === 'Series') return 'tv';
        return null;
    }

    private getRequiredConfig(): JellyfinConnectionConfig {
        const { url, apiKey, userId } = config.jellyfin;
        if (!url || !apiKey) {
            throw new Error('Jellyfin is not configured. Set JELLYFIN_URL and JELLYFIN_API_KEY.');
        }

        return { url, apiKey, userId };
    }
}

export const jellyfinService = new JellyfinService();
