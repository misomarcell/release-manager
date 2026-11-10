import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PosterService } from '../../services/poster.service';
import { WatchlistService } from '../../services/watchlist.service';
import { WatchlistDialogComponent, type WatchlistDialogData } from '../watchlist-dialog/watchlist-dialog';
import { extractHttpError } from '../../utils/http-error';
import { formatBytes } from '../../utils/format-bytes';
import type { WatchlistItem } from '@rm/shared/watchlist.models';

@Component({
    selector: 'app-watchlist-card',
    imports: [
        DatePipe,
        MatBadgeModule,
        MatButtonModule,
        MatChipsModule,
        MatDividerModule,
        MatExpansionModule,
        MatIconModule,
    ],
    templateUrl: './watchlist-card.html',
    styleUrl: './watchlist-card.scss',
})
export class WatchlistCardComponent {
    private watchlist = inject(WatchlistService);
    private poster = inject(PosterService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private router = inject(Router);

    item = input.required<WatchlistItem>();

    protected busy = signal(false);
    protected newCount = computed(() => this.item().newReleases.length);
    protected formatBytes = formatBytes;

    protected openPoster(event: MouseEvent): void {
        event.stopPropagation();
        const item = this.item();
        if (!item.poster) return;
        this.poster.open(item.poster, item.title);
    }

    protected async markRead(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            await this.watchlist.markRead(this.item().id);
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to mark as read'), 'OK', { duration: 5000 });
        } finally {
            this.busy.set(false);
        }
    }

    protected editFilter(): void {
        const item = this.item();
        this.dialog.open<WatchlistDialogComponent, WatchlistDialogData>(WatchlistDialogComponent, {
            data: { tmdbId: item.tmdbId, mediaType: item.mediaType, title: item.title, item },
            width: '90vw',
            maxWidth: '520px',
            autoFocus: false,
        });
    }

    protected searchReleases(): void {
        const item = this.item();
        const query = item.title
            .replace(/[^\p{L}\p{N} ]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        void this.router.navigate(['/releases'], {
            queryParams: { q: query, category: item.mediaType === 'tv' ? 'tv' : 'movies' },
        });
    }
}
