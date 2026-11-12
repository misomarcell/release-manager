import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { MediaType } from '@rm/shared/tmdb.models';
import type { TrackerFailure } from '@rm/shared/tracker.models';
import type {
    WatchlistAddRequest,
    WatchlistCheckResponse,
    WatchlistItem,
    WatchlistResponse,
    WatchlistUpdateRequest,
} from '@rm/shared/watchlist.models';

@Injectable({ providedIn: 'root' })
export class WatchlistService {
    private api = inject(ApiService);

    items = signal<WatchlistItem[]>([]);
    loaded = signal(false);
    error = signal(false);
    unreadCount = computed(() => this.items().reduce((sum, item) => sum + item.newReleases.length, 0));

    private byMedia = computed(
        () => new Map(this.items().map((item) => [mediaKey(item.tmdbId, item.mediaType), item])),
    );

    find(tmdbId: number, mediaType: MediaType): WatchlistItem | null {
        return this.byMedia().get(mediaKey(tmdbId, mediaType)) ?? null;
    }

    async load(): Promise<void> {
        try {
            const response = await this.api.get<WatchlistResponse>('/api/watchlist');
            this.items.set(response.items);
            this.error.set(false);
        } catch {
            this.error.set(true);
        } finally {
            this.loaded.set(true);
        }
    }

    async checkNow(): Promise<TrackerFailure[]> {
        const response = await this.api.post<WatchlistCheckResponse>('/api/watchlist/check');
        this.items.set(response.items);

        return response.failures;
    }

    async add(request: WatchlistAddRequest): Promise<WatchlistItem> {
        const item = await this.api.post<WatchlistItem>('/api/watchlist', request);
        this.items.update((items) => [item, ...items.filter((existing) => existing.id !== item.id)]);

        return item;
    }

    async updateKeywords(id: number, keywords: string[]): Promise<WatchlistItem> {
        const item = await this.api.patch<WatchlistItem>(`/api/watchlist/${id}`, {
            keywords,
        } satisfies WatchlistUpdateRequest);
        this.replace(item);

        return item;
    }

    async markRead(id: number): Promise<void> {
        await this.api.post<void>(`/api/watchlist/${id}/read`);
        this.items.update((items) => items.map((item) => (item.id === id ? { ...item, newReleases: [] } : item)));
    }

    async remove(id: number): Promise<void> {
        await this.api.delete<void>(`/api/watchlist/${id}`);
        this.items.update((items) => items.filter((item) => item.id !== id));
    }

    private replace(item: WatchlistItem): void {
        this.items.update((items) => items.map((existing) => (existing.id === item.id ? item : existing)));
    }
}

function mediaKey(tmdbId: number, mediaType: MediaType): string {
    return `${mediaType}:${tmdbId}`;
}
