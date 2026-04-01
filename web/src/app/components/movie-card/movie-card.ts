import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { NfoDialogComponent } from '../nfo-dialog/nfo-dialog';
import { DownloadDialogComponent } from '../download-dialog/download-dialog';
import type { DownloadDialogData } from '../download-dialog/download-dialog';
import type { GroupedMovie } from '../search/search';
import type { NcoreResult } from '../../../../../shared/src/ncore.models';

const TV_CATEGORIES = new Set(['hdser_hun', 'hdser']);
const MOVIES_BASE = '/srv/media/Movies';
const TV_BASE = '/srv/media/TV_Shows';

@Component({
  selector: 'app-movie-card',
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatDividerModule],
  templateUrl: './movie-card.html',
  styleUrl: './movie-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieCardComponent {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private api = inject(ApiService);

  movie = input.required<GroupedMovie>();
  searchTitle = output<string>();

  protected displayTitle = computed(() => {
    const m = this.movie();
    return m.omdb?.title || m.omdb_lookup.title;
  });

  protected onSearchTitle(): void {
    const clean = this.displayTitle()
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    this.searchTitle.emit(clean);
  }

  protected async showNfo(torrentId: string): Promise<void> {
    const html = await this.api.fetchNfo(torrentId);
    this.dialog.open(NfoDialogComponent, {
      data: { html },
      width: '90vw',
      maxWidth: '800px',
    });
  }

  protected download(release: NcoreResult): void {
    const isTV = TV_CATEGORIES.has(release.category);
    const title = this.displayTitle();
    const category = isTV ? 'tv' : ('movies' as const);
    let suggestedPath: string;

    if (isTV) {
      const tv = release.tvInfo;
      if (tv?.type === 'episode' && tv.season != null) {
        const s = String(tv.season).padStart(2, '0');
        suggestedPath = `${TV_BASE}/${title}/Season ${s}`;
      } else {
        suggestedPath = `${TV_BASE}/${title}`;
      }
    } else {
      suggestedPath = MOVIES_BASE;
    }

    const dialogRef = this.dialog.open(DownloadDialogComponent, {
      data: { release, title, isTV, suggestedPath, category } satisfies DownloadDialogData,
      width: '90vw',
      maxWidth: '560px',
    });

    dialogRef.afterClosed().subscribe((success: boolean | undefined) => {
      if (success) {
        this.snackBar.open('Sent to qBittorrent', 'OK', { duration: 3000 });
      }
    });
  }

  protected formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const val = bytes / 1024 ** i;
    return `${val.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  }
}
