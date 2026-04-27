import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PosterService } from '../../../services/poster.service';
import { RecommendationsService } from '../../../services/recommendations.service';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

interface DialogData {
  rec: Recommendation;
}

@Component({
  selector: 'app-recommendation-detail-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './recommendation-detail-dialog.html',
  styleUrl: './recommendation-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationDetailDialogComponent {
  private data = inject(MAT_DIALOG_DATA) as DialogData;
  private dialogRef = inject(MatDialogRef<RecommendationDetailDialogComponent, string | null>);
  private poster = inject(PosterService);
  private recommendationsService = inject(RecommendationsService);

  protected rec = this.data.rec;
  protected feedback = computed(
    () => this.recommendationsService.feedback()[`${this.rec.mediaType}:${this.rec.tmdbId}`] ?? null,
  );
  protected submitting = computed(
    () => this.recommendationsService.submitting()[`${this.rec.mediaType}:${this.rec.tmdbId}`] ?? false,
  );

  protected openPoster(): void {
    if (!this.rec.poster) return;
    this.poster.open(this.rec.poster, this.rec.title);
  }

  protected async sendFeedback(value: FeedbackValue): Promise<void> {
    await this.recommendationsService.submitFeedback(this.rec, value);
  }

  protected searchAndClose(): void {
    this.dialogRef.close(this.rec.title);
  }
}
