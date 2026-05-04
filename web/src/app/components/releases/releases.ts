import { ChangeDetectionStrategy, Component, inject, signal, computed, viewChild } from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ReleaseCardComponent } from '../release-card/release-card';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { SearchService } from '../../services/search.service';
import { TitleService } from '../../services/title.service';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { NcoreCategoryKey, NcoreResult } from '@rm/shared/ncore.models';
import { extractHttpError } from '../../utils/http-error';

const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];
const RELEASE_SEARCH_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'category',
        label: 'Category',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'All' },
            { value: 'movies', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
    {
        key: 'uhdOnly',
        label: 'Quality',
        control: 'toggle',
        defaultValue: true,
        options: [{ value: 'true', label: '4K only' }],
    },
];

export interface GroupedMovie {
    key: string;
    metadata: NcoreResult['metadata'];
    metadata_lookup: NcoreResult['metadata_lookup'];
    imdb_id: string;
    releases: NcoreResult[];
}

@Component({
    selector: 'app-releases',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatAccordion,
        MatPaginatorModule,
        ReleaseCardComponent,
        FilterSearchComponent,
    ],
    templateUrl: './releases.html',
    styleUrl: './releases.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleasesComponent {
    private search = inject(SearchService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);
    private releaseSearch = viewChild(FilterSearchComponent);
    private titleService = inject(TitleService);

    protected releaseFilters = RELEASE_SEARCH_FILTERS;
    protected loading = signal(false);
    protected error = signal<string | null>(null);
    private results = signal<NcoreResult[]>([]);
    protected readonly skeletonItems = [0, 1, 2, 3, 4, 5];
    protected totalResults = signal(0);
    protected currentPage = signal(1);
    protected readonly pageSize = 100;

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

    constructor() {
        this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
            const query: string = params['q'] ?? '';
            const cat: string = params['category'];
            const category: NcoreCategoryKey = (VALID_CATEGORIES as string[]).includes(cat)
                ? (cat as NcoreCategoryKey)
                : 'all';
            const uhdOnly = params['uhd'] !== 'false';
            const page = Math.max(1, parseInt(params['page'], 10) || 1);
            this.currentPage.set(page);
            queueMicrotask(() => this.releaseSearch()?.setState(query, { category, uhdOnly }));
            void this.loadResults(query, category, uhdOnly, page);
        });
    }

    protected onSearch(params: FilterSearchSubmit): void {
        const category = this.getCategoryFilter(params.filters['category']);
        const uhdOnly = params.filters['uhdOnly'] === true;
        this.currentPage.set(1);
        void this.loadResults(params.query, category, uhdOnly, 1);
    }

    protected onSearchByTitle(title: string): void {
        this.releaseSearch()?.setQuery(title);
    }

    protected onPage(event: PageEvent): void {
        const page = event.pageIndex + 1;
        this.currentPage.set(page);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const p = this.route.snapshot.queryParams;
        const cat: string = p['category'];
        void this.loadResults(
            p['q'] ?? '',
            (VALID_CATEGORIES as string[]).includes(cat) ? (cat as NcoreCategoryKey) : 'all',
            p['uhd'] !== 'false',
            page,
        );
    }

    private async loadResults(
        query: string,
        category: NcoreCategoryKey,
        uhdOnly: boolean,
        page: number,
    ): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        this.syncQueryParams(query, category, uhdOnly, page);
        const hasSearchTerm = !!query.trim();
        this.titleService.setTitle(
            hasSearchTerm
                ? `Results for: ${query.trim()}`
                : category === 'movies'
                  ? 'Top Movies'
                  : category === 'tv'
                    ? 'Top TV Shows'
                    : 'Top Releases',
        );
        try {
            const response = await this.search.search(category, query, page, this.pageSize, !hasSearchTerm && uhdOnly);
            this.results.set(response.results);
            this.totalResults.set(response.totalResults);
        } catch (e: unknown) {
            this.error.set(extractHttpError(e, 'Search failed'));
            this.results.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private syncQueryParams(query: string, category: NcoreCategoryKey, uhdOnly: boolean, page: number): void {
        const params: Record<string, string> = {};
        if (query.trim()) params['q'] = query.trim();
        if (category !== 'all') params['category'] = category;
        if (!uhdOnly) params['uhd'] = 'false';
        if (page > 1) params['page'] = String(page);
        this.location.replaceState('/releases', new URLSearchParams(params).toString());
    }

    private getCategoryFilter(value: unknown): NcoreCategoryKey {
        return typeof value === 'string' && (VALID_CATEGORIES as string[]).includes(value)
            ? (value as NcoreCategoryKey)
            : 'all';
    }
}
