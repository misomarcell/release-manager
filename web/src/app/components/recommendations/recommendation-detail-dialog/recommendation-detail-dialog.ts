import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PosterService } from '../../../services/poster.service';
import { RecommendationsService } from '../../../services/recommendations.service';
import { FeedbackButtonsComponent } from '../../feedback-buttons/feedback-buttons';
import { MediaActionsMenuComponent } from '../../media-actions-menu/media-actions-menu';
import type { Recommendation } from '@rm/shared/recommendations.models';

interface DialogData {
    rec: Recommendation;
}

@Component({
    selector: 'app-recommendation-detail-dialog',
    imports: [MatDialogModule, MatButtonModule, MatIconModule, FeedbackButtonsComponent, MediaActionsMenuComponent],
    templateUrl: './recommendation-detail-dialog.html',
    styleUrl: './recommendation-detail-dialog.scss',
})
export class RecommendationDetailDialogComponent implements OnInit {
    private data = inject(MAT_DIALOG_DATA) as DialogData;
    private dialogRef = inject(MatDialogRef<RecommendationDetailDialogComponent, string | null>);
    private poster = inject(PosterService);
    private recommendationsService = inject(RecommendationsService);

    protected rec = this.data.rec;

    ngOnInit(): void {
        void this.recommendationsService.fetchFeedback(this.rec.tmdbId, this.rec.mediaType);
    }

    protected openPoster(): void {
        if (!this.rec.poster) return;
        this.poster.open(this.rec.poster, this.rec.title);
    }

    protected searchAndClose(): void {
        this.dialogRef.close(this.rec.title);
    }
}
