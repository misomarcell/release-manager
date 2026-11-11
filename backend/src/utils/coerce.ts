export function asRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function asNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

export function asBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
}
