export type NcoreCategoryKey = 'all' | 'movies' | 'tv' | 'music' | 'games' | 'software' | 'books';
export interface NcoreResult {
    name: string;
    size: string;
    seeds: number;
    leech: number;
    link: string;
    desc_link: string;
    engine_url: string;
}
export interface NcoreSearchResponse {
    query: string;
    category: NcoreCategoryKey;
    requestUrl: string;
    data: unknown;
    results: NcoreResult[];
}
//# sourceMappingURL=ncore.models.d.ts.map