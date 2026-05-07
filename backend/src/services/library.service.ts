import {
    getLibraryPage,
    getLibraryItem,
    deleteLibraryItem as deleteLibraryItemRow,
    reloadCache,
    type LibraryPage,
} from '../repositories/jellyfin.repository.js';
import { getTorrentReferences } from '../repositories/qbittorrent.repository.js';
import { qbittorrentService } from './qbittorrent.service.js';
import { logger } from '../utils/logger.js';
import type { LibraryItem } from 'shared/jellyfin.models';
import type { MediaType } from 'shared/tmdb.models';

interface LibraryQuery {
    search: string;
    page: number;
    perPage: number;
    mediaType: MediaType | null;
}

class LibraryService {
    async getLibrary({ search, page, perPage, mediaType }: LibraryQuery): Promise<LibraryPage> {
        const libraryPage = await getLibraryPage(search, page, perPage, mediaType);
        if (libraryPage.items.length === 0) return libraryPage;

        const torrentHashesByPath = await this.buildTorrentHashLookup();
        return {
            ...libraryPage,
            items: libraryPage.items.map((item) => {
                const contentPath = this.getContentPath(item);
                const torrentHash = contentPath ? torrentHashesByPath.get(contentPath) : null;
                return torrentHash ? { ...item, torrentHash } : item;
            }),
        };
    }

    async deleteLibraryItem(jellyfinId: string): Promise<void> {
        const item = await getLibraryItem(jellyfinId);
        if (!item) {
            throw new Error('Library item not found.');
        }

        const torrentHashesByPath = await this.buildTorrentHashLookup();
        const contentPath = this.getContentPath(item);
        const torrentHash = contentPath ? torrentHashesByPath.get(contentPath) : null;
        if (!torrentHash) {
            throw new Error('No matching torrent found for this library item.');
        }

        logger.info('Library: deleting item', {
            jellyfinId,
            title: item.title,
            torrentHash,
        });

        await qbittorrentService.deleteTorrent(torrentHash);
        await deleteLibraryItemRow(jellyfinId);
        await reloadCache();
    }

    private async buildTorrentHashLookup(): Promise<Map<string, string>> {
        const torrentHashesByPath = new Map<string, string>();
        const torrents = await getTorrentReferences();

        for (const torrent of torrents) {
            const contentPath = this.normalizePath(torrent.contentPath);
            if (contentPath && !torrentHashesByPath.has(contentPath)) {
                torrentHashesByPath.set(contentPath, torrent.hash);
            }
        }

        return torrentHashesByPath;
    }

    private getContentPath(item: LibraryItem): string | null {
        const normalizedPath = this.normalizePath(item.path);
        if (!normalizedPath || item.mediaType !== 'movie') return normalizedPath;

        const separatorIndex = normalizedPath.lastIndexOf('/');
        return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : null;
    }

    private normalizePath(path: string | null): string | null {
        const normalized = path?.trim().replace(/\\/g, '/').replace(/\/+$/, '') ?? '';
        return normalized || null;
    }
}

export const libraryService = new LibraryService();
