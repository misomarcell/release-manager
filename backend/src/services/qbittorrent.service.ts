import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { asNumber, asRecord, asString } from '../utils/coerce.js';
import { deleteTorrentByHash, replaceTorrents, type QbittorrentTorrent } from '../repositories/qbittorrent.repository.js';
import { logSync } from '../repositories/sync.repository.js';
import type { DownloadCategory } from 'shared/constants';

const TORRENT_HASH_PATTERN = /^[a-f0-9]{40}$/i;
const REQUEST_TIMEOUT_MS = 30_000;

interface QbittorrentServerState {
    connectionStatus: string;
    freeSpaceOnDisk: number;
}

interface QbittorrentRawTorrent {
    name: string;
    hash: string;
    content_path: string;
    added_on: number;
}

class QbittorrentService {
    private sessionCookie = '';
    private pendingLogin: Promise<void> | null = null;

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

    async syncTorrents(): Promise<number> {
        try {
            logger.info('[qBittorrent] Torrent sync started');

            const torrents = await this.fetchTorrents();
            await replaceTorrents(torrents);

            logger.info('[qBittorrent] Torrent sync completed', { itemCount: torrents.length });
            await logSync('qbittorrent', true, torrents.length, null);

            return torrents.length;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error('[qBittorrent] Torrent sync failed', { error: message });
            await logSync('qbittorrent', false, null, message);
            throw error;
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

        await deleteTorrentByHash(torrentHash);
    }

    async testConnection(): Promise<{ version: string }> {
        const response = await this.qbtFetch('/api/v2/app/version', { method: 'GET' });
        if (!response.ok) {
            throw new Error(`qBittorrent returned ${response.status}`);
        }

        const version = await response.text();
        return { version };
    }

    private async fetchTorrents(): Promise<QbittorrentTorrent[]> {
        const response = await this.qbtFetch('/api/v2/torrents/info', { method: 'GET' });
        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`qBittorrent torrent list failed: ${response.status} ${responseText}`);
        }

        return this.array(await response.json())
            .map((item) => this.toTorrent(item))
            .filter((torrent): torrent is QbittorrentTorrent => torrent !== null);
    }

    private toTorrent(value: unknown): QbittorrentTorrent | null {
        const raw = this.toRawTorrent(value);
        const hash = this.normalizeTorrentHash(raw.hash);
        const name = raw.name.trim();
        if (!hash || !name) return null;

        return {
            hash,
            name,
            contentPath: this.normalizePath(raw.content_path),
            addedOn: this.toDate(raw.added_on),
        };
    }

    private toRawTorrent(value: unknown): QbittorrentRawTorrent {
        const record = asRecord(value);
        return {
            name: asString(record['name']),
            hash: asString(record['hash']),
            content_path: asString(record['content_path']),
            added_on: asNumber(record['added_on']),
        };
    }

    private login(): Promise<void> {
        this.pendingLogin ??= this.doLogin().finally(() => {
            this.pendingLogin = null;
        });
        return this.pendingLogin;
    }

    private async doLogin(): Promise<void> {
        const { username, password } = config.qbittorrent;
        const url = this.getBaseUrl();

        logger.info('[qBittorrent] Logging in', { url });

        const response = await fetch(`${url}/api/v2/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username, password }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`qBittorrent login failed: ${response.status} ${responseText}`);
        }

        const setCookie = response.headers.get('set-cookie');
        const match = setCookie?.match(/(?:^|,\s*)(QBT_SID_[^=;]+|SID)=([^;]+)/);
        if (!match) {
            const details = responseText ? `: ${responseText}` : '';
            throw new Error(`qBittorrent login did not return a session cookie${details}`);
        }

        this.sessionCookie = `${match[1]}=${match[2]}`;
        logger.info('[qBittorrent] Login successful');
    }

    private async qbtFetch(path: string, init: RequestInit): Promise<Response> {
        const url = this.getBaseUrl();

        const send = () =>
            fetch(`${url}${path}`, {
                ...init,
                headers: this.getHeaders(init.headers),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

        let response = await send();
        if (response.status === 403) {
            await this.login();
            response = await send();
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

    private normalizeTorrentHash(hash: string): string | null {
        const torrentHash = hash.trim().toLowerCase();
        return TORRENT_HASH_PATTERN.test(torrentHash) ? torrentHash : null;
    }

    private getTorrentHash(hash: string): string {
        const torrentHash = this.normalizeTorrentHash(hash);
        if (!torrentHash) {
            throw new Error('Invalid torrent hash.');
        }

        return torrentHash;
    }

    private toDate(unixSeconds: number): Date | null {
        if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return null;
        return new Date(unixSeconds * 1000);
    }

    private normalizePath(value: string): string {
        const normalized = value.trim().replace(/\\/g, '/');
        return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
    }

    private array(value: unknown): unknown[] {
        return Array.isArray(value) ? value : [];
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
