import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ListDetailComponent } from '../list-detail/list-detail';
import { PageTitleComponent } from '../page-title/page-title';
import { RowSkeletonsComponent } from '../row-skeletons/row-skeletons';
import { TitleDetailComponent, type StatusCell } from '../title-detail/title-detail';
import { TitleRowComponent } from '../title-row/title-row';
import { WatchlistSheetService } from '../watchlist-dialog/watchlist-sheet.service';
import { WatchlistService } from '../../services/watchlist.service';
import { injectIsDesktop } from '../../utils/breakpoint';
import { formatBytes } from '../../utils/format-bytes';
import { extractHttpError } from '../../utils/http-error';
import { parseQuery } from '../../utils/query-params';
import type { WatchlistItem } from '@rm/shared/watchlist.models';

const DATE_FORMAT = 'yyyy-MM-dd HH:mm';

@Component({
    selector: 'app-watchlist',
    imports: [
        DatePipe,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        ListDetailComponent,
        PageTitleComponent,
        RowSkeletonsComponent,
        TitleDetailComponent,
        TitleRowComponent,
    ],
    providers: [DatePipe],
    templateUrl: './watchlist.html',
    styleUrl: './watchlist.scss',
})
export class WatchlistComponent implements OnInit {
    private snackBar = inject(MatSnackBar);
    private datePipe = inject(DatePipe);
    private isDesktop = injectIsDesktop();
    private watchlistSheet = inject(WatchlistSheetService);
    protected watchlist = inject(WatchlistService);

    open = input('', { transform: parseQuery });

    protected checking = signal(false);
    protected busy = signal(false);
    protected dateFormat = DATE_FORMAT;
    protected formatBytes = formatBytes;
    protected items = computed(() =>
        [...this.watchlist.items()].sort((a, b) => Number(b.newReleases.length > 0) - Number(a.newReleases.length > 0)),
    );
    protected selected = computed(() => {
        const items = this.items();
        return items.find((item) => String(item.id) === this.open()) ?? (this.isDesktop() ? items[0] : undefined);
    });

    protected trackerStatus = computed<StatusCell | null>(() => {
        const item = this.selected();
        if (!item) return null;
        const checked = this.datePipe.transform(item.lastCheckedAt, DATE_FORMAT);
        return {
            value: `${item.releaseCount} known ${item.releaseCount === 1 ? 'release' : 'releases'}`,
            detail: checked ? `last checked ${checked}` : 'not checked yet',
        };
    });

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

    protected async markRead(item: WatchlistItem): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            await this.watchlist.markRead(item.id);
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to mark as read'), 'OK', { duration: 5000 });
        } finally {
            this.busy.set(false);
        }
    }

    protected editFilter(item: WatchlistItem): void {
        this.watchlistSheet.open(item);
    }
}
