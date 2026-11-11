import { Component, computed, effect, inject, input, output, resource } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PosterComponent } from '../poster/poster';
import { WatchlistSheetService } from '../watchlist-dialog/watchlist-sheet.service';
import { PosterService } from '../../services/poster.service';
import { RecommendationsService } from '../../services/recommendations.service';
import { SearchService } from '../../services/search.service';
import { WatchlistService } from '../../services/watchlist.service';
import { cleanSearchTerm } from '../../utils/search-term';
import type { FeedbackValue } from '@rm/shared/recommendations.models';
import type { MediaType } from '@rm/shared/tmdb.models';

export interface StatusCell {
    value: string;
    detail?: string;
    tone?: 'yes' | 'new';
}

@Component({
    selector: 'app-title-detail',
    imports: [RouterLink, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule, PosterComponent],
    templateUrl: './title-detail.html',
    styleUrl: './title-detail.scss',
})
export class TitleDetailComponent {
    private router = inject(Router);
    private location = inject(Location);
    private search = inject(SearchService);
    private posters = inject(PosterService);
    private recommendations = inject(RecommendationsService);
    private watchlist = inject(WatchlistService);
    private watchlistSheet = inject(WatchlistSheetService);

    backLabel = input.required<string>();
    title = input.required<string>();
    tmdbId = input<number | null>();
    mediaType = input<MediaType | null>();
    poster = input<string | null>();
    year = input<string | null>();
    rating = input<string | null>();
    genre = input<string | null>();
    imdbId = input<string | null>();
    trackers = input<StatusCell | null>(null);
    hideTrackers = input(false);
    library = input<StatusCell | null>(null);
    jellyfinUrl = input<string | null>(null);
    canDelete = input(false);
    deleting = input(false);
    deleteAction = output<void>();

    protected media = computed(() => {
        const tmdbId = this.tmdbId();
        const mediaType = this.mediaType();
        return tmdbId && mediaType ? { tmdbId, mediaType } : null;
    });

    private detailResource = resource({
        params: () => this.media() ?? undefined,
        loader: ({ params }) => this.search.fetchMovieDetail(params.tmdbId, params.mediaType),
    });
    protected detailLoading = this.detailResource.isLoading;
    protected detail = computed(() => (this.detailResource.hasValue() ? this.detailResource.value() : null));

    protected facts = computed(() => {
        const detail = this.detail();
        const mediaType = this.mediaType();
        return [
            mediaType ? (mediaType === 'tv' ? 'TV Show' : 'Movie') : '',
            this.year() || detail?.year,
            detail?.runtime,
            detail?.rated,
        ].filter(Boolean);
    });
    protected shownRating = computed(() => this.rating() || this.detail()?.rating);
    protected shownGenre = computed(() => this.genre() || this.detail()?.genre);
    protected shownPoster = computed(() => this.poster() || this.detail()?.poster);
    protected imdbUrl = computed(() => {
        const id = this.imdbId() || this.detail()?.imdbId;
        return id ? `https://www.imdb.com/title/${id}` : null;
    });
    protected trailerUrl = computed(() => {
        const key = this.detail()?.trailerKey;
        return key ? `https://www.youtube.com/watch?v=${key}` : null;
    });
    protected wokeUrl = computed(() => `https://isitwokeornot.com/search?q=${encodeURIComponent(this.title())}`);
    protected releasesQuery = computed(() => ({
        q: cleanSearchTerm(this.title()),
        category: this.mediaType() === 'tv' ? 'tv' : this.mediaType() === 'movie' ? 'movies' : null,
    }));

    protected watchItem = computed(() => {
        const media = this.media();
        return media ? this.watchlist.find(media.tmdbId, media.mediaType) : null;
    });
    protected feedback = computed(() => {
        const media = this.media();
        return media ? this.recommendations.currentFeedback(media.tmdbId, media.mediaType) : null;
    });
    protected feedbackBusy = computed(() => {
        const media = this.media();
        return !media || this.recommendations.isSubmitting(media.tmdbId, media.mediaType);
    });

    protected libraryStatus = computed<StatusCell>(() => {
        const library = this.library();
        if (library) return library;
        if (this.detailLoading()) return { value: '…' };
        return this.detail()?.inJellyfinLibrary
            ? { value: 'In library', tone: 'yes' }
            : { value: 'Not in library' };
    });
    protected watchlistStatus = computed<StatusCell>(() => {
        const item = this.watchItem();
        if (!item) return { value: 'Not following', detail: 'Follow to hear about new releases' };
        const filter = item.keywords.length ? `filter: ${item.keywords.join(', ')}` : 'all releases';
        const count = item.newReleases.length;
        return count
            ? { value: `${count} new ${count === 1 ? 'release' : 'releases'}`, detail: filter, tone: 'new' }
            : { value: 'Following', detail: filter };
    });

    constructor() {
        effect(() => {
            const media = this.media();
            if (media) void this.recommendations.fetchFeedback(media.tmdbId, media.mediaType);
        });
    }

    protected close(): void {
        if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
            this.location.back();
        } else {
            void this.router.navigate([], { queryParams: { open: null }, queryParamsHandling: 'merge', replaceUrl: true });
        }
    }

    protected openPoster(): void {
        const poster = this.shownPoster();
        if (poster) this.posters.open(poster, this.title());
    }

    protected follow(): void {
        const media = this.media();
        if (media) this.watchlistSheet.open({ ...media, title: this.title(), year: this.year(), poster: this.shownPoster() });
    }

    protected sendFeedback(value: FeedbackValue): void {
        const media = this.media();
        if (media) void this.recommendations.submitFeedback(media, value);
    }
}
