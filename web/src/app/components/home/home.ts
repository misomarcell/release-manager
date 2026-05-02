import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ReleaseCardComponent } from '../release-card/release-card';
import { ReleaseSearchComponent, SearchParams } from '../release-search/release-search';
import { SearchService } from '../../services/search.service';
import { ActivatedRoute } from '@angular/router';
import type { NcoreCategoryKey, NcoreResult } from '@rm/shared/ncore.models';

const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];

export interface GroupedMovie {
    key: string;
    metadata: NcoreResult['metadata'];
    metadata_lookup: NcoreResult['metadata_lookup'];
    imdb_id: string;
    releases: NcoreResult[];
}

interface SearchFilters {
    query: string;
    category: NcoreCategoryKey;
    uhdOnly: boolean;
}

@Component({
    selector: 'app-home',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatAccordion,
        MatPaginatorModule,
        ReleaseCardComponent,
        ReleaseSearchComponent,
    ],
    templateUrl: './home.html',
    styleUrl: './home.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
    private search = inject(SearchService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);
    private releaseSearch = viewChild(ReleaseSearchComponent);

    protected loading = signal(false);
    protected error = signal<string | null>(null);
    private results = signal<NcoreResult[]>([]);
    protected readonly skeletonItems = [0, 1, 2, 3, 4, 5];
    protected totalResults = signal(0);
    protected currentPage = signal(1);
    protected readonly pageSize = 100;

    private filters = signal<SearchFilters>({ query: '', category: 'all', uhdOnly: true });
    private lastSearchTerm = signal('');

    protected groupedMovies = computed(() => {
        const results = this.results();
        const groups = new Map<string, GroupedMovie>();
        for (const r of results) {
            const key = r.imdb_id || `${r.metadata_lookup.title}::${r.metadata_lookup.year}`;
            const existing = groups.get(key);
            if (existing) {
                existing.releases.push(r);
                if (!existing.metadata && r.metadata) {
                    existing.metadata = r.metadata;
                }
            } else {
                groups.set(key, {
                    key,
                    metadata: r.metadata,
                    metadata_lookup: r.metadata_lookup,
                    imdb_id: r.imdb_id,
                    releases: [r],
                });
            }
        }
        return [...groups.values()];
    });

    protected listTitle = computed(() => {
        const term = this.lastSearchTerm();
        if (term) return `Results for: ${term}`;
        const { category } = this.filters();
        if (category === 'movies') return 'Top Movies';
        if (category === 'tv') return 'Top TV Shows';
        return 'Top Releases';
    });

    ngOnInit(): void {
        const params = this.route.snapshot.queryParams;
        const cat = params['category'];
        this.filters.set({
            query: params['q'] ?? '',
            category: cat && VALID_CATEGORIES.includes(cat) ? (cat as NcoreCategoryKey) : 'all',
            uhdOnly: params['uhd'] !== 'false',
        });
        const page = parseInt(params['page'], 10);
        if (page > 0) {
            this.currentPage.set(page);
        }

        // Sync initial state to child after view init without emitting a search (which would reset page to 1)
        queueMicrotask(() => {
            const { query, category, uhdOnly } = this.filters();
            this.releaseSearch()?.initState(query, category, uhdOnly);
        });

        void this.loadResults();
    }

    protected onSearch(params: SearchParams): void {
        this.filters.set({ query: params.query, category: params.category, uhdOnly: params.uhdOnly });
        this.currentPage.set(1);
        void this.loadResults();
    }

    protected onSearchByTitle(title: string): void {
        this.releaseSearch()?.setQuery(title);
    }

    protected onPage(event: PageEvent): void {
        this.currentPage.set(event.pageIndex + 1);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        void this.loadResults();
    }

    private async loadResults(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        this.syncQueryParams();

        const { query, category, uhdOnly } = this.filters();
        try {
            const hasSearchTerm = !!query.trim();
            this.lastSearchTerm.set(query.trim());
            const response = await this.search.search(
                category,
                query,
                this.currentPage(),
                this.pageSize,
                !hasSearchTerm && uhdOnly,
            );
            this.results.set(response.results);
            this.totalResults.set(response.totalResults);
        } catch (e: unknown) {
            this.error.set(e instanceof Error ? e.message : 'Search failed');
            this.results.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private syncQueryParams(): void {
        const { query, category, uhdOnly } = this.filters();
        const params: Record<string, string> = {};
        if (query.trim()) params['q'] = query.trim();
        if (category !== 'all') params['category'] = category;
        if (!uhdOnly) params['uhd'] = 'false';
        if (this.currentPage() > 1) params['page'] = String(this.currentPage());
        this.location.replaceState('/releases', new URLSearchParams(params).toString());
    }
}
