import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { asNumber, asRecord, asString } from '../utils/coerce.js';
import type { DownloadCategory } from 'shared/constants';

const TORRENT_HASH_PATTERN = /^[a-f0-9]{40}$/i;

interface QbittorrentServerState {
    connectionStatus: string;
    freeSpaceOnDisk: number;
}

class QbittorrentService {
    private sessionCookie = '';

    async addTorrent(torrentData: ArrayBuffer, savePath: string, category: DownloadCategory): Promise<void> {
        const formData = new FormData();
        formData.append('torrents', new Blob([torrentData], { type: 'application/x-bittorrent' }), 'release.torrent');
        formData.append('savepath', savePath);
        formData.append('category', category);

        logger.info('[qBittorrent] Adding new torrent', {
            savePath,
            category,
            size: torrentData.byteLength,
        });

        const response = await this.qbtFetch('/api/v2/torrents/add', {
            method: 'POST',
            body: formData,
        });

        const responseText = await response.text();
        logger.info('[qBittorrent] Torrent add response', { status: response.status, responseText });

        if (!response.ok) {
            throw new Error(`qBittorrent add failed: ${response.status} ${responseText}`);
        }
    }

    async getServerState(): Promise<QbittorrentServerState> {
        const response = await this.qbtFetch('/api/v2/sync/maindata', { method: 'GET' });
        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`qBittorrent main data failed: ${response.status} ${responseText}`);
        }

        const mainData = asRecord(await response.json());
        const serverState = asRecord(mainData['server_state']);
        return {
            connectionStatus: asString(serverState['connection_status']),
            freeSpaceOnDisk: asNumber(serverState['free_space_on_disk']),
        };
    }

    async deleteTorrent(hash: string): Promise<void> {
        const torrentHash = this.getTorrentHash(hash);
        const response = await this.qbtFetch('/api/v2/torrents/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ hashes: torrentHash, deleteFiles: 'true' }),
        });

        const responseText = await response.text();
        logger.info('[qBittorrent] Torrent delete response', {
            hash: torrentHash,
            status: response.status,
            responseText,
        });

        if (!response.ok) {
            throw new Error(`qBittorrent delete failed: ${response.status} ${responseText}`);
        }
    }

    async testConnection(): Promise<{ version: string }> {
        const response = await this.qbtFetch('/api/v2/app/version', { method: 'GET' });
        if (!response.ok) {
            throw new Error(`qBittorrent returned ${response.status}`);
        }

        const version = await response.text();
        return { version };
    }

    private async login(): Promise<void> {
        const { username, password } = config.qbittorrent;
        const url = this.getBaseUrl();

        logger.info('[qBittorrent] Logging in', { url });

        const response = await fetch(`${url}/api/v2/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username, password }),
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`qBittorrent login failed: ${response.status} ${responseText}`);
        }

        const setCookie = response.headers.get('set-cookie');
        const sid = setCookie?.match(/SID=([^;]+)/)?.[1];
        if (!sid) {
            const details = responseText ? `: ${responseText}` : '';
            throw new Error(`qBittorrent login did not return a session cookie${details}`);
        }

        this.sessionCookie = `SID=${sid}`;
        logger.info('[qBittorrent] Login successful');
    }

    private async qbtFetch(path: string, init: RequestInit): Promise<Response> {
        const url = this.getBaseUrl();

        let response = await fetch(`${url}${path}`, {
            ...init,
            headers: this.getHeaders(init.headers),
        });

        if (response.status === 403) {
            this.sessionCookie = '';
            await this.login();
            response = await fetch(`${url}${path}`, {
                ...init,
                headers: this.getHeaders(init.headers),
            });
        }

        return response;
    }

    private getHeaders(headers?: RequestInit['headers']): Headers {
        const nextHeaders = new Headers(headers);
        if (this.sessionCookie) {
            nextHeaders.set('Cookie', this.sessionCookie);
        }

        return nextHeaders;
    }

    private getTorrentHash(hash: string): string {
        const torrentHash = hash.trim();
        if (!TORRENT_HASH_PATTERN.test(torrentHash)) {
            throw new Error('Invalid torrent hash.');
        }

        return torrentHash;
    }

    private getBaseUrl(): string {
        const { url } = config.qbittorrent;
        if (!url) {
            throw new Error('qBittorrent is not configured. Set QBITTORRENT_URL.');
        }

        return url.replace(/\/+$/, '');
    }
}

export const qbittorrentService = new QbittorrentService();
