import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DownloadDialogComponent, type DownloadDialogData } from '../download-dialog/download-dialog';
import { NfoDialogComponent } from '../nfo-dialog/nfo-dialog';
import { AuthService } from '../../services/auth.service';
import { SearchService } from '../../services/search.service';
import { formatBytes } from '../../utils/format-bytes';
import { extractHttpError } from '../../utils/http-error';
import { sheetConfig } from '../../utils/sheet';
import { describeRelease } from '../../utils/release-view';
import type { NcoreResult } from '@rm/shared/ncore.models';

const TV_CATEGORIES = new Set(['hdser_hun', 'hdser']);
const MOVIES_BASE = '/media/Movies';
const TV_BASE = '/media/TV_Shows';

@Component({
    selector: 'app-release-list',
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './release-list.html',
    styleUrl: './release-list.scss',
})
export class ReleaseListComponent {
    private dialog = inject(MatDialog);
    private snackBar = inject(MatSnackBar);
    private search = inject(SearchService);
    protected auth = inject(AuthService);

    releases = input.required<NcoreResult[]>();
    title = input.required<string>();

    protected rows = computed(() => this.releases().map((release) => ({ release, ...describeRelease(release) })));
    protected formatBytes = formatBytes;

    protected async showNfo(torrentId: string): Promise<void> {
        try {
            const html = await this.search.fetchNfo(torrentId);
            this.dialog.open(NfoDialogComponent, sheetConfig({ html }, 800));
        } catch (e: unknown) {
            this.snackBar.open(extractHttpError(e, 'Failed to load NFO'), 'OK', { duration: 5000 });
        }
    }

    protected download(release: NcoreResult): void {
        const isTV = TV_CATEGORIES.has(release.category);
        const data: DownloadDialogData = {
            release,
            isTV,
            category: isTV ? 'TV Shows' : 'Movies',
            suggestedPath: isTV ? this.tvPath(release) : MOVIES_BASE,
        };

        this.dialog
            .open<DownloadDialogComponent, DownloadDialogData, boolean>(
                DownloadDialogComponent,
                sheetConfig(data, 560, '.save-path'),
            )
            .afterClosed()
            .subscribe((success) => {
                if (success) this.snackBar.open('Sent to qBittorrent', 'OK', { duration: 3000 });
            });
    }

    private tvPath(release: NcoreResult): string {
        const tv = release.tvInfo;
        const season =
            tv?.type === 'episode' && tv.season != null ? `/Season ${String(tv.season).padStart(2, '0')}` : '';
        return `${TV_BASE}/${this.title()}${season}`;
    }
}
