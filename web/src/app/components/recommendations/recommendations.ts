import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../services/api.service';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

@Component({
  selector: 'app-recommendations',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './recommendations.html',
  styleUrl: './recommendations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationsComponent implements OnInit {
  private api = inject(ApiService);

  protected recommendations = signal<Recommendation[]>([]);
  protected loading = signal(true);
  protected feedback = signal<Record<string, FeedbackValue>>({});
  protected submitting = signal<Record<string, boolean>>({});

  async ngOnInit(): Promise<void> {
    try {
      const recs = await this.api.getRecommendations();
      this.recommendations.set(recs);
    } catch {
      // Recommendations are optional — fail silently
    } finally {
      this.loading.set(false);
    }
  }

  protected trackByTmdb(_: number, rec: Recommendation): string {
    return `${rec.mediaType}:${rec.tmdbId}`;
  }

  protected currentFeedback(rec: Recommendation): FeedbackValue | null {
    return this.feedback()[`${rec.mediaType}:${rec.tmdbId}`] ?? null;
  }

  protected async sendFeedback(rec: Recommendation, value: FeedbackValue): Promise<void> {
    const key = `${rec.mediaType}:${rec.tmdbId}`;

    if (this.submitting()[key]) return;

    // Toggle off if clicking the same button again
    if (this.currentFeedback(rec) === value) {
      return;
    }

    this.submitting.update((s) => ({ ...s, [key]: true }));

    const summary = [
      rec.genre,
      rec.year,
      rec.plot ? rec.plot.slice(0, 120) : '',
    ]
      .filter(Boolean)
      .join(', ');

    try {
      await this.api.submitRecommendationFeedback({
        tmdbId: rec.tmdbId,
        mediaType: rec.mediaType,
        title: rec.title,
        summary,
        feedback: value,
      });
      this.feedback.update((f) => ({ ...f, [key]: value }));
    } finally {
      this.submitting.update((s) => ({ ...s, [key]: false }));
    }
  }
}
