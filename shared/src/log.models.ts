export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
    id: number;
    level: LogLevel;
    message: string;
    context: Record<string, unknown> | null;
    created_at: string;
}

export interface LogsResponse {
    logs: LogEntry[];
    total: number;
}
