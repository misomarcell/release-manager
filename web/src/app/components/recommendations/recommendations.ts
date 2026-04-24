import { ChangeDetectionStrategy, Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../services/api.service';
import { RecommendationDetailDialogComponent } from './recommendation-detail-dialog/recommendation-detail-dialog';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

@Component({
  selector: 'app-recommendations',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  @Output() searchTitle = new EventEmitter<string>();

  protected open = signal(false);
  private loaded = signal(false);
  protected recommendations = signal<Recommendation[]>([]);
  protected loading = signal(false);
  protected canRefresh = signal(false);
  protected refreshing = signal(false);
  protected feedback = signal<Record<string, FeedbackValue>>({});
  protected submitting = signal<Record<string, boolean>>({});

  protected toggleOpen(): void {
    const next = !this.open();
    this.open.set(next);
    if (next && !this.loaded()) {
      void this.loadRecommendations();
    }
  }

  private async loadRecommendations(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.getRecommendations();
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
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const response = await this.api.refreshRecommendations();
      this.recommendations.set(response.recommendations);
      this.canRefresh.set(response.canRefresh);
      this.feedback.set({});
    } catch {
      // Fail silently
    } finally {
      this.refreshing.set(false);
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
      if (result) this.searchTitle.emit(result);
    });
  }

  protected currentFeedback(rec: Recommendation): FeedbackValue | null {
    return this.feedback()[`${rec.mediaType}:${rec.tmdbId}`] ?? null;
  }

  protected async sendFeedback(rec: Recommendation, value: FeedbackValue): Promise<void> {
    const key = `${rec.mediaType}:${rec.tmdbId}`;

    if (this.submitting()[key]) return;

    if (this.currentFeedback(rec) === value) {
      return;
    }

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
    } finally {
      this.submitting.update((s) => ({ ...s, [key]: false }));
    }
  }
}
