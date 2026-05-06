import { query } from '../db/connection.js';

export interface QbittorrentTorrent {
    hash: string;
    name: string;
    contentPath: string;
    addedOn: Date | null;
}

interface TorrentReference {
    hash: string;
    contentPath: string;
}

export async function replaceTorrents(torrents: QbittorrentTorrent[]): Promise<void> {
    await query('DELETE FROM qbittorrent_torrents');

    if (torrents.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];

    torrents.forEach((torrent, i) => {
        const base = i * 4;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        values.push(torrent.hash, torrent.name, torrent.contentPath, torrent.addedOn);
    });

    await query(
        `INSERT INTO qbittorrent_torrents (hash, name, content_path, added_on)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (hash) DO UPDATE
       SET name = EXCLUDED.name,
           content_path = EXCLUDED.content_path,
           added_on = EXCLUDED.added_on,
           synced_at = NOW()`,
        values,
    );
}

export async function getTorrentReferences(): Promise<TorrentReference[]> {
    const result = await query<{ hash: string; content_path: string }>(
        `SELECT hash, content_path
     FROM qbittorrent_torrents
     ORDER BY added_on DESC NULLS LAST, synced_at DESC`,
    );

    return result.rows.map((row) => ({
        hash: row.hash,
        contentPath: row.content_path,
    }));
}

export async function deleteTorrentByHash(hash: string): Promise<void> {
    await query('DELETE FROM qbittorrent_torrents WHERE hash = $1', [hash]);
}
