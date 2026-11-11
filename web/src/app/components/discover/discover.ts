import { Component, computed, inject, input, resource } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { ListDetailComponent } from '../list-detail/list-detail';
import { RowSkeletonsComponent } from '../row-skeletons/row-skeletons';
import { TitleDetailComponent, type StatusCell } from '../title-detail/title-detail';
import { TitleRowComponent } from '../title-row/title-row';
import { WatchlistSheetService } from '../watchlist-dialog/watchlist-sheet.service';
import { RibbonComponent } from './ribbon/ribbon';
import { RecommendationsService } from '../../services/recommendations.service';
import { SearchService } from '../../services/search.service';
import { WatchlistService } from '../../services/watchlist.service';
import { injectIsDesktop } from '../../utils/breakpoint';
import { extractHttpError } from '../../utils/http-error';
import { parseQuery } from '../../utils/query-params';
import { cleanSearchTerm } from '../../utils/search-term';
import type { Recommendation } from '@rm/shared/recommendations.models';
import type { MediaType, TitleSummary } from '@rm/shared/tmdb.models';

type DiscoverTab = 'trending' | 'personalized';
type TypeFilter = MediaType | 'all';
type DiscoverTitle = TitleSummary | Recommendation;

const TABS: { id: DiscoverTab; label: string; icon: string }[] = [
    { id: 'trending', label: 'Trending', icon: 'local_fire_department' },
    { id: 'personalized', label: 'Personalized', icon: 'auto_awesome' },
];
const TYPE_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'type',
        label: 'Media type',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
];

function titleKey(title: DiscoverTitle): string {
    return `${title.mediaType}:${title.tmdbId}`;
}

@Component({
    selector: 'app-discover',
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        FilterSearchComponent,
        ListDetailComponent,
        RibbonComponent,
        RowSkeletonsComponent,
        TitleDetailComponent,
        TitleRowComponent,
    ],
    templateUrl: './discover.html',
    styleUrl: './discover.scss',
})
export class DiscoverComponent {
    private recommendations = inject(RecommendationsService);
    private search = inject(SearchService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private isDesktop = injectIsDesktop();
    private watchlistSheet = inject(WatchlistSheetService);
    protected watchlist = inject(WatchlistService);

    q = input('', { transform: parseQuery });
    type = input<TypeFilter, unknown>('all', { transform: parseType });
    tab = input<DiscoverTab, unknown>('trending', { transform: parseTab });
    open = input('', { transform: parseQuery });
    focus = input('', { transform: parseQuery });

    protected tabs = TABS;
    protected typeFilters = TYPE_FILTERS;
    protected titleKey = titleKey;
    protected filterValues = computed(() => ({ type: this.type() }));

    protected movies = this.ribbon('movie');
    protected tvShows = this.ribbon('tv');

    private resultsResource = resource({
        params: () => (this.q() ? { query: this.q(), type: this.type() } : undefined),
        loader: ({ params }) => this.search.searchTitles(params.query, params.type === 'all' ? null : params.type),
    });
    protected searching = this.resultsResource.isLoading;
    protected searchError = computed(() => {
        const error = this.resultsResource.error();
        return error ? extractHttpError(error, 'Search failed') : null;
    });
    protected results = computed(() => (this.resultsResource.hasValue() ? this.resultsResource.value().results : []));

    protected selected = computed<DiscoverTitle | undefined>(() => {
        const results = this.results();
        const all: DiscoverTitle[] = this.q() ? results : [...this.movies.items(), ...this.tvShows.items()];
        return all.find((title) => titleKey(title) === this.open()) ?? (this.isDesktop() ? results[0] : undefined);
    });
    protected selectedKey = computed(() => {
        const selected = this.selected();
        return selected ? titleKey(selected) : null;
    });
    protected reason = computed(() => {
        const selected = this.selected();
        return selected && 'reason' in selected ? selected.reason : undefined;
    });
    protected libraryStatus = computed<StatusCell>(() =>
        this.selected()?.inJellyfinLibrary ? { value: 'In library', tone: 'yes' } : { value: 'Not in the library' },
    );
    protected releasesQuery = computed(() => {
        const selected = this.selected();
        return selected
            ? { q: cleanSearchTerm(selected.title), category: selected.mediaType === 'tv' ? 'tv' : 'movies' }
            : null;
    });

    protected isFollowing(title: DiscoverTitle): boolean {
        return !!this.watchlist.find(title.tmdbId, title.mediaType);
    }

    protected follow(title: DiscoverTitle): void {
        this.watchlistSheet.open(title);
    }

    protected onSearch(params: FilterSearchSubmit): void {
        const type = parseType(params.filters['type']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: params.query.trim() || null,
                type: type !== 'all' ? type : null,
                tab: this.tab() !== 'trending' ? this.tab() : null,
            },
        });
    }

    private ribbon(mediaType: MediaType) {
        const source = resource({
            params: () => (this.q() ? undefined : this.tab()),
            loader: ({ params }) =>
                params === 'trending'
                    ? this.recommendations.getTrending(mediaType)
                    : this.recommendations.getPersonalized(mediaType),
        });
        return {
            loading: source.isLoading,
            items: computed(() => (source.hasValue() ? source.value().recommendations : [])),
            canRefresh: computed(() => source.hasValue() && source.value().canRefresh),
            refresh: async () => {
                source.set(undefined);
                source.set(await this.recommendations.refreshPersonalized(mediaType).catch(() => undefined));
            },
        };
    }
}

function parseType(value: unknown): TypeFilter {
    return value === 'movie' || value === 'tv' ? value : 'all';
}

function parseTab(value: unknown): DiscoverTab {
    return value === 'personalized' ? value : 'trending';
}
