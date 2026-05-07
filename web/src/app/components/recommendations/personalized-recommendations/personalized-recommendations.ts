import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RecommendationRibbonsComponent } from '../recommendation-ribbons/recommendation-ribbons';
import { RecommendationsService } from '../../../services/recommendations.service';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-personalized-recommendations',
    imports: [RecommendationRibbonsComponent],
    templateUrl: './personalized-recommendations.html',
    styleUrl: './personalized-recommendations.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalizedRecommendationsComponent implements OnInit {
    private recommendations = inject(RecommendationsService);

    protected movies = signal<Recommendation[]>([]);
    protected tvShows = signal<Recommendation[]>([]);
    protected loadingMovies = signal(false);
    protected loadingTv = signal(false);
    protected canRefreshMovies = signal(false);
    protected canRefreshTv = signal(false);

    ngOnInit(): void {
        void Promise.all([this.loadMovies(), this.loadTvShows()]);
    }

    protected async refreshMovies(): Promise<void> {
        if (this.loadingMovies()) return;
        this.movies.set([]);
        this.loadingMovies.set(true);
        try {
            const response = await this.recommendations.refreshPersonalized('movie');
            this.movies.set(response.recommendations);
            this.canRefreshMovies.set(response.canRefresh);
        } catch {
            // fail silently
        } finally {
            this.loadingMovies.set(false);
        }
    }

    protected async refreshTv(): Promise<void> {
        if (this.loadingTv()) return;
        this.tvShows.set([]);
        this.loadingTv.set(true);
        try {
            const response = await this.recommendations.refreshPersonalized('tv');
            this.tvShows.set(response.recommendations);
            this.canRefreshTv.set(response.canRefresh);
        } catch {
            // fail silently
        } finally {
            this.loadingTv.set(false);
        }
    }

    private async loadMovies(): Promise<void> {
        this.loadingMovies.set(true);
        try {
            const response = await this.recommendations.getPersonalized('movie');
            this.movies.set(response.recommendations);
            this.canRefreshMovies.set(response.canRefresh);
        } catch {
            // fail silently
        } finally {
            this.loadingMovies.set(false);
        }
    }

    private async loadTvShows(): Promise<void> {
        this.loadingTv.set(true);
        try {
            const response = await this.recommendations.getPersonalized('tv');
            this.tvShows.set(response.recommendations);
            this.canRefreshTv.set(response.canRefresh);
        } catch {
            // fail silently
        } finally {
            this.loadingTv.set(false);
        }
    }
}
