import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { MediaType } from 'shared/tmdb.models';
import type { MediaInfo, MediaStream, SeasonInfo } from 'shared/jellyfin.models';
import { replaceLibrary, reloadCache, type JellyfinItem } from '../repositories/jellyfin.repository.js';
import { logSync } from '../repositories/sync.repository.js';

const REQUEST_TIMEOUT_MS = 15_000;
const SYNC_TIMEOUT_MS = 180_000;
const STREAM_TYPES = { Video: 'video', Audio: 'audio', Subtitle: 'subtitle' } as const;

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

interface JellyfinRawEpisode {
    SeriesId?: string;
    ParentIndexNumber?: number;
}

function parseTmdbId(raw: JellyfinRawItem): number | null {
    return parseInt(raw.ProviderIds?.['Tmdb'] ?? '', 10) || null;
}

interface JellyfinConnectionConfig {
    url: string;
    apiKey: string;
    userId: string;
}

class JellyfinService {
    isConfigured(): boolean {
        return Boolean(config.jellyfin.url && config.jellyfin.apiKey);
    }

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

            const data = (await this.jellyfinGet(
                '/Items',
                {
                    Recursive: 'true',
                    IncludeItemTypes: 'Movie,Series',
                    Fields: 'ProviderIds,Name,ProductionYear,DateCreated,MediaSources,Path',
                    ...(userId ? { userId } : {}),
                },
                SYNC_TIMEOUT_MS,
            )) as { Items?: JellyfinRawItem[] };

            const rawItems: JellyfinRawItem[] = Array.isArray(data.Items) ? data.Items : [];
            const seasonsBySeries = await this.fetchSeasonsBySeries(userId);
            const items = rawItems
                .map((raw) => this.toJellyfinItem(raw, seasonsBySeries))
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

    private async fetchSeasonsBySeries(userId: string): Promise<Map<string, SeasonInfo[]>> {
        const data = (await this.jellyfinGet(
            '/Items',
            {
                Recursive: 'true',
                IncludeItemTypes: 'Episode',
                IsMissing: 'false',
                EnableImages: 'false',
                EnableUserData: 'false',
                ...(userId ? { userId } : {}),
            },
            SYNC_TIMEOUT_MS,
        )) as { Items?: JellyfinRawEpisode[] };

        const counts = new Map<string, Map<number, number>>();
        for (const episode of data.Items ?? []) {
            if (!episode.SeriesId || episode.ParentIndexNumber == null) continue;
            const seasons = counts.get(episode.SeriesId) ?? new Map<number, number>();
            seasons.set(episode.ParentIndexNumber, (seasons.get(episode.ParentIndexNumber) ?? 0) + 1);
            counts.set(episode.SeriesId, seasons);
        }

        const result = new Map<string, SeasonInfo[]>();
        for (const [seriesId, seasons] of counts) {
            result.set(
                seriesId,
                [...seasons]
                    .map(([seasonNumber, episodeCount]) => ({ seasonNumber, episodeCount }))
                    .sort((a, b) => a.seasonNumber - b.seasonNumber),
            );
        }
        return result;
    }

    private toJellyfinItem(raw: JellyfinRawItem, seasonsBySeries: Map<string, SeasonInfo[]>): JellyfinItem | null {
        const mediaType = this.mapMediaType(raw.Type);
        if (!mediaType || !raw.Name) return null;

        return {
            jellyfinId: raw.Id,
            tmdbId: parseTmdbId(raw),
            mediaType,
            title: raw.Name,
            year: raw.ProductionYear ? String(raw.ProductionYear) : null,
            dateCreated: raw.DateCreated ? new Date(raw.DateCreated) : null,
            mediaInfo: this.parseMediaInfo(raw.MediaSources),
            sizeBytes: raw.MediaSources?.[0]?.Size ?? null,
            path: raw.Path ?? null,
            seasons: seasonsBySeries.get(raw.Id) ?? null,
        };
    }

    private parseMediaInfo(mediaSources: JellyfinRawMediaSource[] | undefined): MediaInfo | null {
        const streams = mediaSources?.[0]?.MediaStreams;
        if (!streams?.length) return null;

        const mapped = streams
            .filter((s) => s.Type in STREAM_TYPES)
            .map((s): MediaStream => {
                const base: MediaStream = {
                    type: STREAM_TYPES[s.Type],
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

    private async jellyfinGet(
        path: string,
        params?: Record<string, string>,
        timeoutMs = REQUEST_TIMEOUT_MS,
    ): Promise<unknown> {
        const { url } = this.getRequiredConfig();
        const endpoint = new URL(path, url);
        for (const [key, value] of Object.entries(params ?? {})) {
            endpoint.searchParams.set(key, value);
        }

        console.log(`[Jellyfin] GET ${endpoint.pathname}${endpoint.search}`);

        const response = await fetch(endpoint, {
            headers: this.authHeaders(),
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
            throw new Error(`Jellyfin responded with ${response.status} for ${path}`);
        }

        return response.json();
    }

    private authHeaders(): Record<string, string> {
        return {
            Authorization: `MediaBrowser Token="${config.jellyfin.apiKey}"`,
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
            throw new Error('Jellyfin is not configured. Add its URL and API key in Settings.');
        }

        return { url, apiKey, userId };
    }
}

export const jellyfinService = new JellyfinService();
