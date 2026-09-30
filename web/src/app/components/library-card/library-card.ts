import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { SearchService } from '../../services/search.service';
import { RecommendationsService } from '../../services/recommendations.service';
import { PosterService } from '../../services/poster.service';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { MediaDetailsComponent } from '../media-details/media-details';
import { MediaStreamsComponent } from '../media-streams/media-streams';
import { SeasonSummaryComponent } from '../season-summary/season-summary';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { computeMediaBadges, type Badge } from '../../utils/media-badges';
import { extractHttpError } from '../../utils/http-error';
import type { LibraryItem } from '@rm/shared/jellyfin.models';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-library-card',
    imports: [
        MatExpansionModule,
        MatIconModule,
        MatDividerModule,
        MediaDetailsComponent,
        MediaStreamsComponent,
        SeasonSummaryComponent,
    ],
    templateUrl: './library-card.html',
    styleUrl: './library-card.scss',
})
export class LibraryCardComponent {
    private search = inject(SearchService);
    private recommendations = inject(RecommendationsService);
    private poster = inject(PosterService);
    private admin = inject(AdminService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    protected auth = inject(AuthService);

    item = input.required<LibraryItem>();
    jellyfinBaseUrl = input<string>('');
    deleted = output<string>();

    protected detail = signal<MovieDetailMetadata | null>(null);
    protected detailLoading = signal(false);
    protected deleting = signal(false);
    private detailLoaded = false;

    protected canBeDeleted = computed(() => this.auth.admin() && !!this.item().torrentHash);
    protected displayTitle = computed(() => this.item().title);

    protected jellyfinUrl = computed(() => {
        const base = this.jellyfinBaseUrl();
        const id = this.item().jellyfinId;
        if (!base || !id) return null;
        return `${base}/web/#/details?id=${id}`;
    });

    protected badges = computed((): Badge[] => {
        const streams = this.item().mediaInfo?.streams;
        return streams ? computeMediaBadges(streams) : [];
    });

    protected async onPanelOpened(): Promise<void> {
        if (this.detailLoaded) return;
        const i = this.item();
        if (!i.tmdbId || !i.mediaType) {
            this.detailLoaded = true;
            return;
        }

        this.detailLoading.set(true);
        try {
            const [detail] = await Promise.all([
                this.search.fetchMovieDetail(i.tmdbId, i.mediaType).catch(() => null),
                this.recommendations.fetchFeedback(i.tmdbId, i.mediaType),
            ]);
            this.detail.set(detail);
        } finally {
            this.detailLoading.set(false);
            this.detailLoaded = true;
        }
    }

    protected openPoster(event: MouseEvent): void {
        event.stopPropagation();
        const url = this.item().poster;
        if (!url) return;
        this.poster.open(url, this.displayTitle());
    }

    protected async deleteItem(): Promise<void> {
        const item = this.item();
        if (!item.torrentHash || this.deleting()) return;

        const confirmed = await this.confirm(
            `Delete ${item.title}`,
            `Are you sure you want to delete ${item.title}? This will remove the torrent from qBittorrent and delete its downloaded files.`,
        );
        if (!confirmed) return;

        this.deleting.set(true);
        try {
            await this.admin.deleteLibraryItem(item.jellyfinId);
            this.deleted.emit(item.jellyfinId);
            this.snackBar.open(`Deleted ${item.title}`, 'OK', { duration: 3000 });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, `Failed to delete ${item.title}`), 'OK', { duration: 5000 });
        } finally {
            this.deleting.set(false);
        }
    }

    private async confirm(title: string, message: string): Promise<boolean> {
        const result = await firstValueFrom(
            this.dialog
                .open(ConfirmDialogComponent, {
                    data: { title, message, confirmLabel: 'Delete' },
                    autoFocus: false,
                })
                .afterClosed(),
        );
        return result === true;
    }
}
