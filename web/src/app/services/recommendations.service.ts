import { inject, Injectable, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from './api.service';
import type {
    Recommendation,
    FeedbackValue,
    RecommendationFeedbackRequest,
    RecommendationsResponse,
} from '@rm/shared/recommendations.models';
import type { MediaType } from '@rm/shared/tmdb.models';

interface FeedbackTarget {
    tmdbId: number;
    mediaType: MediaType;
    title: string;
    genre?: string;
    year?: string;
    plot?: string;
}

@Injectable({ providedIn: 'root' })
export class RecommendationsService {
    private api = inject(ApiService);
    private snackBar = inject(MatSnackBar);

    feedback = signal<Record<string, FeedbackValue>>({});
    submitting = signal<Record<string, boolean>>({});
    private fetched = new Set<string>();

    feedbackKey(tmdbId: number, mediaType: string): string {
        return `${mediaType}:${tmdbId}`;
    }

    currentFeedback(tmdbId: number, mediaType: MediaType): FeedbackValue | null {
        return this.feedback()[this.feedbackKey(tmdbId, mediaType)] ?? null;
    }

    isSubmitting(tmdbId: number, mediaType: MediaType): boolean {
        return this.submitting()[this.feedbackKey(tmdbId, mediaType)] ?? false;
    }

    seedFeedback(recs: Recommendation[]): void {
        const updates: Record<string, FeedbackValue> = {};
        for (const rec of recs) {
            const key = this.feedbackKey(rec.tmdbId, rec.mediaType);
            this.fetched.add(key);
            if (rec.feedback) {
                updates[key] = rec.feedback;
            }
        }
        if (Object.keys(updates).length > 0) {
            this.feedback.update((f) => ({ ...f, ...updates }));
        }
    }

    async fetchFeedback(tmdbId: number, mediaType: MediaType): Promise<void> {
        const key = this.feedbackKey(tmdbId, mediaType);
        if (this.fetched.has(key)) return;
        this.fetched.add(key);
        try {
            const result = await this.getFeedback(tmdbId, mediaType);
            if (result.feedback) {
                this.feedback.update((f) => ({ ...f, [key]: result.feedback! }));
            }
        } catch {
            this.fetched.delete(key);
        }
    }

    async submitFeedback(target: FeedbackTarget, value: FeedbackValue): Promise<boolean> {
        const key = this.feedbackKey(target.tmdbId, target.mediaType);
        if (this.submitting()[key]) return false;
        if (this.currentFeedback(target.tmdbId, target.mediaType) === value) return false;

        const previous = this.currentFeedback(target.tmdbId, target.mediaType);
        this.submitting.update((s) => ({ ...s, [key]: true }));

        const summary = [target.genre, target.year, target.plot ? target.plot.slice(0, 120) : undefined]
            .filter(Boolean)
            .join(', ');

        try {
            await this.submitRecommendationFeedback({
                tmdbId: target.tmdbId,
                mediaType: target.mediaType,
                title: target.title,
                summary,
                feedback: value,
            });
            this.feedback.update((f) => ({ ...f, [key]: value }));
            this.fetched.add(key);
            return true;
        } catch {
            if (previous) {
                this.feedback.update((f) => ({ ...f, [key]: previous }));
            } else {
                this.feedback.update((f) => {
                    const next = { ...f };
                    delete next[key];
                    return next;
                });
            }
            this.snackBar.open('Failed to save feedback. Please try again.', 'OK', { duration: 4000 });
            return false;
        } finally {
            this.submitting.update((s) => ({ ...s, [key]: false }));
        }
    }

    async getRecommendations(mediaType?: MediaType): Promise<RecommendationsResponse> {
        let params = new HttpParams();
        if (mediaType) params = params.set('mediaType', mediaType);
        return this.api.get<RecommendationsResponse>('/api/recommendations', params);
    }

    async refreshRecommendations(mediaType?: MediaType): Promise<RecommendationsResponse> {
        let params = new HttpParams();
        if (mediaType) params = params.set('mediaType', mediaType);
        return this.api.post<RecommendationsResponse>('/api/recommendations/refresh', {}, params);
    }

    async getFeedback(tmdbId: number, mediaType: MediaType): Promise<{ feedback: FeedbackValue | null }> {
        const params = new HttpParams().set('tmdbId', tmdbId.toString()).set('mediaType', mediaType);
        return this.api.get<{ feedback: FeedbackValue | null }>('/api/recommendations/feedback', params);
    }

    async submitRecommendationFeedback(request: RecommendationFeedbackRequest): Promise<void> {
        await this.api.post<void>('/api/recommendations/feedback', request);
    }
}
