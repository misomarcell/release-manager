import { Component, computed, input, output } from '@angular/core';
import { FeedbackButtonsComponent } from '../feedback-buttons/feedback-buttons';
import { MediaActionsMenuComponent } from '../media-actions-menu/media-actions-menu';
import { WatchlistButtonComponent } from '../watchlist-button/watchlist-button';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';
import type { MediaType } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-media-details',
    imports: [FeedbackButtonsComponent, MediaActionsMenuComponent, WatchlistButtonComponent],
    templateUrl: './media-details.html',
    styleUrl: './media-details.scss',
})
export class MediaDetailsComponent {
    tmdbId = input<number | null>(null);
    mediaType = input<MediaType | null>(null);
    title = input<string>('');
    imdbId = input<string>('');
    jellyfinUrl = input<string | null>(null);
    detail = input<MovieDetailMetadata | null>(null);
    detailLoading = input<boolean>(false);
    deleteActionDisabled = input<boolean>(false);
    canBeDeleted = input<boolean>(false);
    deleteAction = output<void>();

    protected hasMedia = computed(() => !!this.tmdbId() && !!this.mediaType());
    protected hasDetailStrip = computed(
        () => !!this.mediaType() || !!this.detail()?.rated || !!this.detail()?.runtime || !!this.detail()?.releaseDate,
    );
    protected hasActionLinks = computed(
        () => !!this.title() || !!this.imdbId() || !!this.detail()?.trailerKey || !!this.jellyfinUrl(),
    );
    protected hasMenuActions = computed(() => this.hasActionLinks() || this.canBeDeleted());
}
