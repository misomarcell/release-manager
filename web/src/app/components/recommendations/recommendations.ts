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
import { RecommendationsService } from '../../services/recommendations.service';
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
  private dialog = inject(MatDialog);
  private router = inject(Router);
  protected recommendations = inject(RecommendationsService);

  @ViewChildren('movieCard') movieCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('tvCard') tvCards!: QueryList<ElementRef<HTMLElement>>;

  protected movies = signal<Recommendation[]>([]);
  protected tvShows = signal<Recommendation[]>([]);
  protected loadingMovies = signal(false);
  protected loadingTv = signal(false);
  protected canRefreshMovies = signal(false);
  protected canRefreshTv = signal(false);
  protected readonly skeletonItems = [0, 1, 2, 3, 4];

  ngOnInit(): void {
    void this.loadMovies();
    void this.loadTvShows();
  }

  private async loadMovies(): Promise<void> {
    this.loadingMovies.set(true);
    try {
      const response = await this.recommendations.getRecommendations('movie');
      this.movies.set(response.recommendations);
      this.canRefreshMovies.set(response.canRefresh);
      this.recommendations.seedFeedback(response.recommendations);
    } catch {
      // fail silently
    } finally {
      this.loadingMovies.set(false);
    }
  }

  private async loadTvShows(): Promise<void> {
    this.loadingTv.set(true);
    try {
      const response = await this.recommendations.getRecommendations('tv');
      this.tvShows.set(response.recommendations);
      this.canRefreshTv.set(response.canRefresh);
      this.recommendations.seedFeedback(response.recommendations);
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
      const response = await this.recommendations.refreshRecommendations('movie');
      this.movies.set(response.recommendations);
      this.canRefreshMovies.set(response.canRefresh);
      this.recommendations.seedFeedback(response.recommendations);
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
      const response = await this.recommendations.refreshRecommendations('tv');
      this.tvShows.set(response.recommendations);
      this.canRefreshTv.set(response.canRefresh);
      this.recommendations.seedFeedback(response.recommendations);
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
      data: { rec },
      maxWidth: '480px',
      width: '90vw',
    });
    ref.afterClosed().subscribe((result: string | null | undefined) => {
      if (result) {
        this.router.navigate(['/releases'], { queryParams: { q: result } });
      }
    });
  }

  protected async sendFeedback(
    rec: Recommendation,
    value: FeedbackValue,
    ribbonIndex?: number,
    ribbonType?: 'movie' | 'tv',
  ): Promise<void> {
    const success = await this.recommendations.submitFeedback(rec, value);
    if (success) {
      if (ribbonType === 'movie') this.canRefreshMovies.set(true);
      if (ribbonType === 'tv') this.canRefreshTv.set(true);
      if (ribbonIndex !== undefined) {
        this.scrollToCard(ribbonIndex + 1, ribbonType);
      }
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
