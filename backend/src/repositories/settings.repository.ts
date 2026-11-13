import { query, withTransaction } from '../db/connection.js';

export interface StoredSetting {
    key: string;
    value: string;
    encrypted: boolean;
}

export async function getStoredSettings(): Promise<StoredSetting[]> {
    const result = await query<StoredSetting>('SELECT key, value, encrypted FROM settings');
    return result.rows;
}

export async function saveStoredSettings(upserts: StoredSetting[], removals: string[]): Promise<void> {
    await withTransaction(async (client) => {
        for (const setting of upserts) {
            await client.query(
                `INSERT INTO settings (key, value, encrypted) VALUES ($1, $2, $3)
                 ON CONFLICT (key) DO UPDATE SET value = $2, encrypted = $3, updated_at = NOW()`,
                [setting.key, setting.value, setting.encrypted],
            );
        }
        if (removals.length > 0) {
            await client.query('DELETE FROM settings WHERE key = ANY($1)', [removals]);
        }
    });
}
