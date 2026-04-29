import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { SearchService } from '../../services/search.service';
import { AuthService } from '../../services/auth.service';
import { PosterService } from '../../services/poster.service';
import { RecommendationsService } from '../../services/recommendations.service';
import { NfoDialogComponent } from '../nfo-dialog/nfo-dialog';
import { DownloadDialogComponent } from '../download-dialog/download-dialog';
import { MediaDetailsComponent } from '../media-details/media-details';
import type { DownloadDialogData } from '../download-dialog/download-dialog';
import type { GroupedMovie } from '../home/home';
import type { NcoreResult } from '@rm/shared/ncore.models';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';

const TV_CATEGORIES = new Set(['hdser_hun', 'hdser']);
const MOVIES_BASE = '/media/Movies';
const TV_BASE = '/media/TV_Shows';

@Component({
  selector: 'app-release-card',
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatDividerModule, MediaDetailsComponent],
  templateUrl: './release-card.html',
  styleUrl: './release-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseCardComponent {
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private search = inject(SearchService);
  private poster = inject(PosterService);
  private recommendations = inject(RecommendationsService);
  protected auth = inject(AuthService);

  movie = input.required<GroupedMovie>();
  searchTitle = output<string>();

  protected detail = signal<MovieDetailMetadata | null>(null);
  protected detailLoading = signal(false);
  private detailLoaded = false;

  protected displayTitle = computed(() => {
    const m = this.movie();
    return m.metadata?.title || m.metadata_lookup.title;
  });

  protected onSearchTitle(): void {
    const clean = this.displayTitle()
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    this.searchTitle.emit(clean);
  }

  protected async onPanelOpened(): Promise<void> {
    if (this.detailLoaded) return;
    const m = this.movie();
    if (!m.metadata?.tmdbId || !m.metadata?.mediaType) {
      this.detailLoaded = true;
      return;
    }

    const mediaType = m.metadata.mediaType;
    this.detailLoading.set(true);
    try {
      const [detail] = await Promise.all([
        this.search.fetchMovieDetail(m.metadata.tmdbId, mediaType).catch(() => null),
        this.recommendations.fetchFeedback(m.metadata.tmdbId, mediaType),
      ]);
      this.detail.set(detail);
    } finally {
      this.detailLoading.set(false);
      this.detailLoaded = true;
    }
  }

  protected openPoster(event: MouseEvent): void {
    event.stopPropagation();
    const url = this.movie().metadata?.poster;
    if (!url) return;
    this.poster.open(url, this.displayTitle());
  }

  protected async showNfo(torrentId: string): Promise<void> {
    const html = await this.search.fetchNfo(torrentId);
    this.dialog.open(NfoDialogComponent, {
      data: { html },
      width: '90vw',
      maxWidth: '800px',
      autoFocus: false,
    });
  }

  protected download(release: NcoreResult): void {
    const isTV = TV_CATEGORIES.has(release.category);
    const title = this.displayTitle();
    const category = isTV ? 'TV Shows' : ('Movies' as const);
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
      autoFocus: false,
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
