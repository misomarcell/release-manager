import { Component, computed, inject, input, resource, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { FilterSearchComponent, FilterSearchSubmit, SearchFilterDefinition } from '../filter-search/filter-search';
import { ListDetailComponent } from '../list-detail/list-detail';
import { MediaStreamsComponent } from '../media-streams/media-streams';
import { RowSkeletonsComponent } from '../row-skeletons/row-skeletons';
import { SeasonSummaryComponent } from '../season-summary/season-summary';
import { TitleDetailComponent, type StatusCell } from '../title-detail/title-detail';
import { TitleRowComponent } from '../title-row/title-row';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { LibraryService } from '../../services/library.service';
import { injectIsDesktop } from '../../utils/breakpoint';
import { formatBytes } from '../../utils/format-bytes';
import { extractHttpError } from '../../utils/http-error';
import { computeMediaBadges } from '../../utils/media-badges';
import { parsePage, parseQuery } from '../../utils/query-params';
import type { LibraryItem } from '@rm/shared/jellyfin.models';
import type { MediaType } from '@rm/shared/tmdb.models';

const PAGE_SIZE = 30;
type LibraryMediaFilter = MediaType | 'all';
const VALID_MEDIA_FILTERS: LibraryMediaFilter[] = ['all', 'movie', 'tv'];
const LIBRARY_SEARCH_FILTERS: SearchFilterDefinition[] = [
    {
        key: 'mediaType',
        control: 'select',
        defaultValue: 'all',
        options: [
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
        ],
    },
];

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function seasonSummary(item: LibraryItem): string | null {
    if (!item.seasons?.length) return null;
    const seasons = item.seasons.filter((season) => season.seasonNumber > 0).length;
    const episodes = item.seasons.reduce((sum, season) => sum + season.episodeCount, 0);
    return `${plural(seasons, 'season')} · ${plural(episodes, 'episode')}`;
}

@Component({
    selector: 'app-library',
    imports: [
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        FilterSearchComponent,
        ListDetailComponent,
        MediaStreamsComponent,
        RowSkeletonsComponent,
        SeasonSummaryComponent,
        TitleDetailComponent,
        TitleRowComponent,
    ],
    templateUrl: './library.html',
    styleUrl: './library.scss',
})
export class LibraryComponent {
    private libraryService = inject(LibraryService);
    private admin = inject(AdminService);
    private auth = inject(AuthService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private isDesktop = injectIsDesktop();
    private layout = viewChild.required(ListDetailComponent);

    q = input('', { transform: parseQuery });
    type = input<LibraryMediaFilter, unknown>('all', { transform: parseMediaType });
    page = input(1, { transform: parsePage });
    open = input('', { transform: parseQuery });

    protected libraryFilters = LIBRARY_SEARCH_FILTERS;
    protected searchFilterValues = computed(() => ({ mediaType: this.type() }));
    protected pageSize = PAGE_SIZE;
    protected deleting = signal(false);

    private library = resource({
        params: () => ({ query: this.q(), type: this.type(), page: this.page() }),
        loader: ({ params }) =>
            this.libraryService.getLibrary(
                params.query,
                params.page,
                PAGE_SIZE,
                params.type === 'all' ? null : params.type,
            ),
    });

    protected loading = this.library.isLoading;
    protected error = computed(() => {
        const error = this.library.error();
        return error ? extractHttpError(error, 'Failed to load library') : null;
    });
    protected total = computed(() => (this.library.hasValue() ? this.library.value().total : 0));
    protected remainingSpace = computed(() => {
        const bytes = this.library.hasValue() ? this.library.value().freeSpaceOnDisk : null;
        return bytes === null ? null : formatBytes(bytes);
    });

    protected rows = computed(() =>
        (this.library.hasValue() ? this.library.value().items : []).map((item) => ({
            item,
            info: seasonSummary(item) ?? item.genre,
            tags: computeMediaBadges(item.mediaInfo?.streams ?? []),
            size: item.sizeBytes ? formatBytes(item.sizeBytes) : null,
        })),
    );

    protected selected = computed(() => {
        const rows = this.rows();
        return rows.find((row) => row.item.jellyfinId === this.open()) ?? (this.isDesktop() ? rows[0] : undefined);
    });

    protected jellyfinUrl = computed(() => {
        const base = this.library.hasValue() ? this.library.value().jellyfinBaseUrl : '';
        const id = this.selected()?.item.jellyfinId;
        return base && id ? `${base}/web/#/details?id=${id}` : null;
    });

    protected libraryStatus = computed<StatusCell | null>(() => {
        const row = this.selected();
        if (!row) return null;
        return {
            value: 'In library',
            detail: [seasonSummary(row.item), row.size].filter(Boolean).join(' · '),
            tone: 'yes',
        };
    });

    protected canDelete = computed(() => this.auth.admin() && !!this.selected()?.item.torrentHash);

    protected emptyMessage = computed(() => {
        if (this.q()) return `No results for “${this.q()}”.`;
        if (this.type() !== 'all') {
            return `No ${this.type() === 'movie' ? 'movies' : 'TV shows'} found in your Jellyfin library.`;
        }
        return 'Your Jellyfin library is empty or not yet synced.';
    });

    protected onSearch(params: FilterSearchSubmit): void {
        const mediaType = parseMediaType(params.filters['mediaType']);
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: params.query.trim() || null,
                type: mediaType !== 'all' ? mediaType : null,
            },
        });
    }

    protected onPage(event: PageEvent): void {
        this.layout().scrollListToTop();
        void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { page: event.pageIndex > 0 ? event.pageIndex + 1 : null, open: null },
            queryParamsHandling: 'merge',
        });
    }

    protected async deleteItem(item: LibraryItem): Promise<void> {
        if (this.deleting()) return;

        const confirmed = await firstValueFrom(
            this.dialog
                .open(ConfirmDialogComponent, {
                    data: {
                        title: `Delete ${item.title}`,
                        message: `Are you sure you want to delete ${item.title}? This will remove the torrent from qBittorrent and delete its downloaded files.`,
                        confirmLabel: 'Delete',
                    },
                    autoFocus: false,
                })
                .afterClosed(),
        );
        if (confirmed !== true) return;

        this.deleting.set(true);
        try {
            await this.admin.deleteLibraryItem(item.jellyfinId);
            this.library.update(
                (response) =>
                    response && {
                        ...response,
                        items: response.items.filter((existing) => existing.jellyfinId !== item.jellyfinId),
                        total: Math.max(0, response.total - 1),
                    },
            );
            this.snackBar.open(`Deleted ${item.title}`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, `Failed to delete ${item.title}`), 'OK', { duration: 5000 });
        } finally {
            this.deleting.set(false);
        }
    }
}

function parseMediaType(value: unknown): LibraryMediaFilter {
    return VALID_MEDIA_FILTERS.find((filter) => filter === value) ?? 'all';
}
