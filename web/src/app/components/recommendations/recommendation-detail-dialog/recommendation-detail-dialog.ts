import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Recommendation, FeedbackValue } from '@rm/shared/recommendations.models';

interface DialogData {
  rec: Recommendation;
  currentFeedback: FeedbackValue | null;
  onFeedback: (value: FeedbackValue) => Promise<void>;
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
  protected rec = this.data.rec;
  protected feedback = signal<FeedbackValue | null>(this.data.currentFeedback);
  protected submitting = signal(false);

  protected async sendFeedback(value: FeedbackValue): Promise<void> {
    if (this.submitting() || this.feedback() === value) return;
    this.submitting.set(true);
    try {
      await this.data.onFeedback(value);
      this.feedback.set(value);
    } finally {
      this.submitting.set(false);
    }
  }

  protected searchAndClose(): void {
    this.dialogRef.close(this.rec.title);
  }
}
