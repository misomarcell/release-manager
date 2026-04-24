import {
  ChangeDetectionStrategy,
  Component,
  Output,
  EventEmitter,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { RecommendationDetailDialogComponent } from './recommendation-detail-dialog/recommendation-detail-dialog';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

@Component({
  selector: 'app-recommendations',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  @Output() searchTitle = new EventEmitter<string>();
  @ViewChildren('recCard') recCards!: QueryList<ElementRef<HTMLElement>>;

  protected open = signal(false);
  private loaded = signal(false);
  protected recommendations = signal<Recommendation[]>([]);
  protected loading = signal(false);
  protected canRefresh = signal(false);
  protected filter = signal<'all' | 'movie' | 'tv'>('movie');
  protected feedback = signal<Record<string, FeedbackValue>>({});
  protected submitting = signal<Record<string, boolean>>({});
  protected readonly skeletonItems = [0, 1, 2, 3, 4];

  protected toggleOpen(): void {
    const next = !this.open();
    this.open.set(next);
    if (next && !this.loaded()) {
      void this.loadRecommendations();
    }
  }

  protected changeFilter(f: 'all' | 'movie' | 'tv'): void {
    if (this.filter() === f) return;
    this.filter.set(f);
    this.recommendations.set([]);
    this.loaded.set(false);
    if (this.open()) {
      void this.loadRecommendations();
    }
  }

  private filterParam(): 'movie' | 'tv' | undefined {
    const f = this.filter();
    return f === 'all' ? undefined : f;
  }

  private async loadRecommendations(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.getRecommendations(this.filterParam());
      this.recommendations.set(response.recommendations);
      this.canRefresh.set(response.canRefresh);
      this.loaded.set(true);
    } catch {
      // Recommendations are optional — fail silently
    } finally {
      this.loading.set(false);
    }
  }

  protected async refresh(): Promise<void> {
    if (this.loading()) return;
    this.recommendations.set([]);
    this.loading.set(true);
    try {
      const response = await this.api.refreshRecommendations(this.filterParam());
      this.recommendations.set(response.recommendations);
      this.canRefresh.set(response.canRefresh);
      this.feedback.set({});
    } catch {
      // Fail silently
    } finally {
      this.loading.set(false);
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
        this.open.set(false);
        this.searchTitle.emit(result);
      }
    });
  }

  protected currentFeedback(rec: Recommendation): FeedbackValue | null {
    return this.feedback()[`${rec.mediaType}:${rec.tmdbId}`] ?? null;
  }

  protected async sendFeedback(rec: Recommendation, value: FeedbackValue, ribbonIndex?: number): Promise<void> {
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
      this.canRefresh.set(true);
      if (ribbonIndex !== undefined) {
        this.scrollToCard(ribbonIndex + 1);
      }
    } finally {
      this.submitting.update((s) => ({ ...s, [key]: false }));
    }
  }

  private scrollToCard(index: number): void {
    const cards = this.recCards.toArray();
    const card = cards[index];
    if (card) {
      card.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }
}