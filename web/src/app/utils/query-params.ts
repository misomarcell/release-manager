export function parseQuery(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function parsePage(value: unknown): number {
    return Math.max(1, parseInt(typeof value === 'string' ? value : '', 10) || 1);
}
