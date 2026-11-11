import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WatchlistService } from '../../services/watchlist.service';
import { sheetConfig } from '../../utils/sheet';
import { WatchlistDialogComponent, type WatchlistDialogData, type WatchlistDialogResult } from './watchlist-dialog';

const RESULT_MESSAGES: Record<WatchlistDialogResult, string> = {
    added: 'Added to watchlist',
    updated: 'Watchlist item updated',
    removed: 'Removed from watchlist',
};

type WatchlistTarget = Omit<WatchlistDialogData, 'item'>;

@Injectable({ providedIn: 'root' })
export class WatchlistSheetService {
    private watchlist = inject(WatchlistService);
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);

    open(target: WatchlistTarget): void {
        const item = this.watchlist.find(target.tmdbId, target.mediaType);
        this.dialog
            .open<WatchlistDialogComponent, WatchlistDialogData, WatchlistDialogResult>(
                WatchlistDialogComponent,
                sheetConfig({ ...target, item }),
            )
            .afterClosed()
            .subscribe((result) => {
                if (result) this.snackBar.open(RESULT_MESSAGES[result], 'OK', { duration: 3000 });
            });
    }
}
