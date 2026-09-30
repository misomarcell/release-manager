import { query, withTransaction } from '../db/connection.js';

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
    await withTransaction(async (client) => {
        await client.query('DELETE FROM qbittorrent_torrents');
        if (torrents.length === 0) return;

        await client.query(
            `INSERT INTO qbittorrent_torrents (hash, name, content_path, added_on)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[])
       ON CONFLICT (hash) DO UPDATE
         SET name = EXCLUDED.name,
             content_path = EXCLUDED.content_path,
             added_on = EXCLUDED.added_on,
             synced_at = NOW()`,
            [
                torrents.map((t) => t.hash),
                torrents.map((t) => t.name),
                torrents.map((t) => t.contentPath),
                torrents.map((t) => t.addedOn),
            ],
        );
    });
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
