export function cleanSearchTerm(value: string): string {
    return value
        .replace(/[^\p{L}\p{N} ]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
