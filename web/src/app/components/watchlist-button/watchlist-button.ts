import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WatchlistService } from '../../services/watchlist.service';
import {
    WatchlistDialogComponent,
    type WatchlistDialogData,
    type WatchlistDialogResult,
} from '../watchlist-dialog/watchlist-dialog';
import type { MediaType } from '@rm/shared/tmdb.models';

const RESULT_MESSAGES: Record<WatchlistDialogResult, string> = {
    added: 'Added to watchlist',
    updated: 'Watchlist item updated',
    removed: 'Removed from watchlist',
};

@Component({
    selector: 'app-watchlist-button',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './watchlist-button.html',
    styleUrl: './watchlist-button.scss',
})
export class WatchlistButtonComponent {
    private watchlist = inject(WatchlistService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);

    tmdbId = input.required<number>();
    mediaType = input.required<MediaType>();
    title = input('');

    protected item = computed(() => this.watchlist.find(this.tmdbId(), this.mediaType()));
    protected label = computed(() => (this.item() ? 'On your watchlist' : 'Add to watchlist'));

    protected open(): void {
        const item = this.item();
        this.dialog
            .open<WatchlistDialogComponent, WatchlistDialogData, WatchlistDialogResult>(WatchlistDialogComponent, {
                data: {
                    tmdbId: this.tmdbId(),
                    mediaType: this.mediaType(),
                    title: item?.title || this.title(),
                    item,
                },
                width: '90vw',
                maxWidth: '520px',
                autoFocus: false,
            })
            .afterClosed()
            .subscribe((result) => {
                if (result) {
                    this.snackBar.open(RESULT_MESSAGES[result], 'OK', { duration: 3000 });
                }
            });
    }
}
