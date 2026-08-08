import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RecommendationsService } from '../../services/recommendations.service';
import type { MediaType } from '@rm/shared/tmdb.models';
import type { FeedbackValue } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-feedback-buttons',
    imports: [MatIconModule],
    templateUrl: './feedback-buttons.html',
    styleUrl: './feedback-buttons.scss',
})
export class FeedbackButtonsComponent {
    private recommendations = inject(RecommendationsService);

    tmdbId = input.required<number>();
    mediaType = input.required<MediaType>();

    protected feedbackKey = computed(() => `${this.mediaType()}:${this.tmdbId()}`);
    protected currentFeedback = computed(() => this.recommendations.feedback()[this.feedbackKey()] ?? null);
    protected submitting = computed(() => this.recommendations.submitting()[this.feedbackKey()] ?? false);

    protected async sendFeedback(value: FeedbackValue): Promise<void> {
        await this.recommendations.submitFeedback({ tmdbId: this.tmdbId(), mediaType: this.mediaType() }, value);
    }
}
