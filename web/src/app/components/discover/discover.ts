import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FailureNoticeComponent } from '../failure-notice/failure-notice';
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
import type { FailureNotice } from '../../utils/failure-notice';
import { extractHttpError } from '../../utils/http-error';
import { parseQuery } from '../../utils/query-params';
import { cleanSearchTerm } from '../../utils/search-term';
import type { Recommendation, RecommendationFallback } from '@rm/shared/recommendations.models';
import type { MediaType, TitleSummary } from '@rm/shared/tmdb.models';

type DiscoverTab = 'trending' | 'personalized';
type TypeFilter = MediaType | 'all';
type DiscoverTitle = TitleSummary | Recommendation;

interface RibbonKind {
    mediaType: MediaType;
    heading: string;
    icon: string;
    noun: string;
}

const MOVIES: RibbonKind = { mediaType: 'movie', heading: 'Movies', icon: 'movie', noun: 'movies' };
const TV_SHOWS: RibbonKind = { mediaType: 'tv', heading: 'TV Shows', icon: 'tv', noun: 'TV shows' };
const FALLBACK_HINTS: Record<RecommendationFallback, (noun: string) => string> = {
    'no-feedback': (noun) => `Like or dislike a few ${noun} and picks based on your taste will show up here.`,
    unavailable: () => 'AI picks are not available right now.',
};

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
        FailureNoticeComponent,
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
    private snackBar = inject(MatSnackBar);
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

    protected movies = this.ribbon(MOVIES);
    protected tvShows = this.ribbon(TV_SHOWS);
    protected ribbons = [this.movies, this.tvShows];
    protected failures = computed(() => this.ribbons.flatMap((ribbon) => ribbon.failure() ?? []));

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

    private ribbon(kind: RibbonKind) {
        const { mediaType, heading, icon, noun } = kind;
        const source = resource({
            params: () => (this.q() ? undefined : this.tab()),
            loader: ({ params }) =>
                params === 'trending'
                    ? this.recommendations.getTrending(mediaType)
                    : this.recommendations.getPersonalized(mediaType),
        });
        const refreshing = signal(false);
        const loading = computed(() => source.isLoading() || refreshing());
        const personalized = computed(() => this.tab() === 'personalized');
        const fallback = computed(() => (source.hasValue() && !loading() ? source.value().fallback : undefined));

        return {
            heading,
            icon,
            loading,
            items: computed(() => (source.hasValue() ? source.value().recommendations : [])),
            canRefresh: computed(() => personalized() && source.hasValue() && source.value().canRefresh),
            note: computed(() => {
                if (!personalized()) return 'This week on TMDB';
                if (loading()) return 'Picking for you…';
                return fallback() ? 'Top rated on TMDB' : 'From your likes and dislikes';
            }),
            hint: computed(() => {
                const reason = fallback();
                return reason ? FALLBACK_HINTS[reason](noun) : '';
            }),
            failure: computed<FailureNotice | undefined>(() => {
                const error = source.error();
                return error
                    ? { heading: `${heading} could not be loaded`, detail: extractHttpError(error, 'Request failed') }
                    : undefined;
            }),
            refresh: async () => {
                refreshing.set(true);
                try {
                    const fresh = await this.recommendations.refreshPersonalized(mediaType);
                    if (personalized()) source.set(fresh);
                } catch (error) {
                    this.snackBar.open(extractHttpError(error, 'Could not get new recommendations'), 'OK', {
                        duration: 4000,
                    });
                } finally {
                    refreshing.set(false);
                }
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
