import pg from 'pg';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<T>> {
    return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }
}

export async function closeDatabase(): Promise<void> {
    await pool.end();
}

export async function initDatabase(): Promise<void> {
    await pool.query(SCHEMA_SQL);
}
