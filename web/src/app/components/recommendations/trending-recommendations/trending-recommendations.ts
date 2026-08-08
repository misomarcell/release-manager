import { Component, OnInit, inject, signal } from '@angular/core';
import { RecommendationRibbonsComponent } from '../recommendation-ribbons/recommendation-ribbons';
import { RecommendationsService } from '../../../services/recommendations.service';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-trending-recommendations',
    imports: [RecommendationRibbonsComponent],
    templateUrl: './trending-recommendations.html',
    styleUrl: './trending-recommendations.scss',
})
export class TrendingRecommendationsComponent implements OnInit {
    private recommendations = inject(RecommendationsService);

    protected movies = signal<Recommendation[]>([]);
    protected tvShows = signal<Recommendation[]>([]);
    protected loadingMovies = signal(false);
    protected loadingTv = signal(false);

    ngOnInit(): void {
        void Promise.all([this.loadMovies(), this.loadTvShows()]);
    }

    private async loadMovies(): Promise<void> {
        this.loadingMovies.set(true);
        try {
            const response = await this.recommendations.getTrending('movie');
            this.movies.set(response.recommendations);
        } catch {
            // fail silently
        } finally {
            this.loadingMovies.set(false);
        }
    }

    private async loadTvShows(): Promise<void> {
        this.loadingTv.set(true);
        try {
            const response = await this.recommendations.getTrending('tv');
            this.tvShows.set(response.recommendations);
        } catch {
            // fail silently
        } finally {
            this.loadingTv.set(false);
        }
    }
}
