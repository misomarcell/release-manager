import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WatchlistCardComponent } from '../watchlist-card/watchlist-card';
import { WatchlistService } from '../../services/watchlist.service';
import { extractHttpError } from '../../utils/http-error';

@Component({
    selector: 'app-watchlist',
    imports: [MatAccordion, MatButtonModule, MatIconModule, WatchlistCardComponent],
    templateUrl: './watchlist.html',
    styleUrl: './watchlist.scss',
})
export class WatchlistComponent implements OnInit {
    private snackBar = inject(MatSnackBar);
    protected watchlist = inject(WatchlistService);

    protected checking = signal(false);
    protected items = computed(() =>
        [...this.watchlist.items()].sort((a, b) => Number(b.newReleases.length > 0) - Number(a.newReleases.length > 0)),
    );
    protected readonly skeletonItems = [0, 1, 2];

    ngOnInit(): void {
        void this.watchlist.load();
    }

    protected async checkNow(): Promise<void> {
        if (this.checking()) return;
        this.checking.set(true);
        try {
            await this.watchlist.checkNow();
            const count = this.watchlist.unreadCount();
            this.snackBar.open(count ? `${count} new ${count === 1 ? 'release' : 'releases'}` : 'No new releases', 'OK', {
                duration: 3000,
            });
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to check for new releases'), 'OK', { duration: 5000 });
        } finally {
            this.checking.set(false);
        }
    }
}
