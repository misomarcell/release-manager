import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { SearchService } from '../../services/search.service';
import { RecommendationsService } from '../../services/recommendations.service';
import { PosterService } from '../../services/poster.service';
import { MediaDetailsComponent } from '../media-details/media-details';
import { computeMediaBadges, type Badge } from '../../utils/media-badges';
import type { LibraryItem } from '@rm/shared/jellyfin.models';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-library-card',
    imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatDividerModule, MediaDetailsComponent],
    templateUrl: './library-card.html',
    styleUrl: './library-card.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryCardComponent {
    private search = inject(SearchService);
    private recommendations = inject(RecommendationsService);
    private poster = inject(PosterService);

    item = input.required<LibraryItem>();
    jellyfinBaseUrl = input<string>('');

    protected detail = signal<MovieDetailMetadata | null>(null);
    protected detailLoading = signal(false);
    private detailLoaded = false;

    protected displayTitle = computed(() => this.item().title);

    protected jellyfinUrl = computed(() => {
        const base = this.jellyfinBaseUrl();
        const id = this.item().jellyfinId;
        if (!base || !id) return null;
        return `${base}/web/#/details?id=${id}`;
    });

    protected badges = computed((): Badge[] => {
        const streams = this.item().mediaInfo?.streams;
        return streams ? computeMediaBadges(streams) : [];
    });

    protected async onPanelOpened(): Promise<void> {
        if (this.detailLoaded) return;
        const i = this.item();
        if (!i.tmdbId || !i.mediaType) {
            this.detailLoaded = true;
            return;
        }

        this.detailLoading.set(true);
        try {
            const [detail] = await Promise.all([
                this.search.fetchMovieDetail(i.tmdbId, i.mediaType).catch(() => null),
                this.recommendations.fetchFeedback(i.tmdbId, i.mediaType),
            ]);
            this.detail.set(detail);
        } finally {
            this.detailLoading.set(false);
            this.detailLoaded = true;
        }
    }

    protected openPoster(event: MouseEvent): void {
        event.stopPropagation();
        const url = this.item().poster;
        if (!url) return;
        this.poster.open(url, this.displayTitle());
    }

    protected streamIcon(type: string): string {
        if (type === 'video') return 'videocam';
        if (type === 'audio') return 'volume_up';
        return 'subtitles';
    }
}
