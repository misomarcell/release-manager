import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { RecommendationDetailDialogComponent } from './recommendation-detail-dialog/recommendation-detail-dialog';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

@Component({
  selector: 'app-recommendations',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  @ViewChildren('movieCard') movieCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('tvCard') tvCards!: QueryList<ElementRef<HTMLElement>>;

  protected movies = signal<Recommendation[]>([]);
  protected tvShows = signal<Recommendation[]>([]);
  protected loadingMovies = signal(false);
  protected loadingTv = signal(false);
  protected canRefreshMovies = signal(false);
  protected canRefreshTv = signal(false);
  protected feedback = signal<Record<string, FeedbackValue>>({});
  protected submitting = signal<Record<string, boolean>>({});
  protected readonly skeletonItems = [0, 1, 2, 3, 4];

  ngOnInit(): void {
    void this.loadMovies();
    void this.loadTvShows();
  }

  private async loadMovies(): Promise<void> {
    this.loadingMovies.set(true);
    try {
      const response = await this.api.getRecommendations('movie');
      this.movies.set(response.recommendations);
      this.canRefreshMovies.set(response.canRefresh);
      this.seedFeedback(response.recommendations);
    } catch {
      // fail silently
    } finally {
      this.loadingMovies.set(false);
    }
  }

  private async loadTvShows(): Promise<void> {
    this.loadingTv.set(true);
    try {
      const response = await this.api.getRecommendations('tv');
      this.tvShows.set(response.recommendations);
      this.canRefreshTv.set(response.canRefresh);
      this.seedFeedback(response.recommendations);
    } catch {
      // fail silently
    } finally {
      this.loadingTv.set(false);
    }
  }

  protected async refreshMovies(): Promise<void> {
    if (this.loadingMovies()) return;
    this.movies.set([]);
    this.loadingMovies.set(true);
    try {
      const response = await this.api.refreshRecommendations('movie');
      this.movies.set(response.recommendations);
      this.canRefreshMovies.set(response.canRefresh);
      this.seedFeedback(response.recommendations);
    } catch {
      // fail silently
    } finally {
      this.loadingMovies.set(false);
    }
  }

  protected async refreshTv(): Promise<void> {
    if (this.loadingTv()) return;
    this.tvShows.set([]);
    this.loadingTv.set(true);
    try {
      const response = await this.api.refreshRecommendations('tv');
      this.tvShows.set(response.recommendations);
      this.canRefreshTv.set(response.canRefresh);
      this.seedFeedback(response.recommendations);
    } catch {
      // fail silently
    } finally {
      this.loadingTv.set(false);
    }
  }

  protected trackByTmdb(_: number, rec: Recommendation): string {
    return `${rec.mediaType}:${rec.tmdbId}`;
  }

  protected openDetail(rec: Recommendation): void {
    const ref = this.dialog.open(RecommendationDetailDialogComponent, {
      data: {
        rec,
        currentFeedback: this.currentFeedback(rec),
        onFeedback: (value: FeedbackValue) => this.sendFeedback(rec, value),
      },
      maxWidth: '480px',
      width: '90vw',
    });
    ref.afterClosed().subscribe((result: string | null | undefined) => {
      if (result) {
        this.router.navigate(['/'], { queryParams: { q: result } });
      }
    });
  }

  protected currentFeedback(rec: Recommendation): FeedbackValue | null {
    return this.feedback()[`${rec.mediaType}:${rec.tmdbId}`] ?? null;
  }

  protected async sendFeedback(
    rec: Recommendation,
    value: FeedbackValue,
    ribbonIndex?: number,
    ribbonType?: 'movie' | 'tv',
  ): Promise<void> {
    const key = `${rec.mediaType}:${rec.tmdbId}`;

    if (this.submitting()[key]) return;
    if (this.currentFeedback(rec) === value) return;

    this.submitting.update((s) => ({ ...s, [key]: true }));

    const summary = [rec.genre, rec.year, rec.plot ? rec.plot.slice(0, 120) : ''].filter(Boolean).join(', ');

    try {
      await this.api.submitRecommendationFeedback({
        tmdbId: rec.tmdbId,
        mediaType: rec.mediaType,
        title: rec.title,
        summary,
        feedback: value,
      });
      this.feedback.update((f) => ({ ...f, [key]: value }));
      if (ribbonType === 'movie') this.canRefreshMovies.set(true);
      if (ribbonType === 'tv') this.canRefreshTv.set(true);
      if (ribbonIndex !== undefined) {
        this.scrollToCard(ribbonIndex + 1, ribbonType);
      }
    } finally {
      this.submitting.update((s) => ({ ...s, [key]: false }));
    }
  }

  private seedFeedback(recs: Recommendation[]): void {
    const updates: Record<string, FeedbackValue> = {};
    for (const rec of recs) {
      if (rec.feedback) updates[`${rec.mediaType}:${rec.tmdbId}`] = rec.feedback;
    }
    if (Object.keys(updates).length > 0) {
      this.feedback.update((f) => ({ ...f, ...updates }));
    }
  }

  private scrollToCard(index: number, ribbonType?: 'movie' | 'tv'): void {
    const cards = (ribbonType === 'tv' ? this.tvCards : this.movieCards).toArray();
    const card = cards[index];
    if (card) {
      card.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }
}
