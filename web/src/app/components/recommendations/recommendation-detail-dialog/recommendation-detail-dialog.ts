import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
  selector: 'app-recommendation-detail-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './recommendation-detail-dialog.html',
  styleUrl: './recommendation-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationDetailDialogComponent {
  protected rec = inject<Recommendation>(MAT_DIALOG_DATA);
}
