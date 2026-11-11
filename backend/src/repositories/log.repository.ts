import { query } from '../db/connection.js';
import type { LogEntry } from 'shared/log.models';

export async function getLogs(
    level: string | null,
    limit: number,
    offset: number,
): Promise<{ logs: LogEntry[]; total: number }> {
    const params: unknown[] = [];
    let where = '';

    if (level) {
        params.push(level);
        where = `WHERE level = $1`;
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const countParams = level ? [level] : [];

    const [logsResult, countResult] = await Promise.all([
        query<LogEntry>(
            `SELECT id, level, message, context, created_at FROM logs ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params,
        ),
        query<{ count: string }>(`SELECT COUNT(*) as count FROM logs ${where}`, countParams),
    ]);

    return {
        logs: logsResult.rows,
        total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
}
