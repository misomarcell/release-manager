export async function mapConcurrent<T, U>(
    items: readonly T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
    if (items.length === 0) return [];

    const safeLimit = Math.max(1, Math.min(limit, items.length));
    const results = new Array<U>(items.length);
    let cursor = 0;

    const workers = Array.from({ length: safeLimit }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await mapper(items[index], index);
        }
    });

    await Promise.all(workers);
    return results;
}
