import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackButtonsComponent } from '../feedback-buttons/feedback-buttons';
import { MediaActionChipsComponent } from '../media-action-chips/media-action-chips';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';
import type { MediaType } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-media-details',
    imports: [MatButtonModule, MatIconModule, FeedbackButtonsComponent, MediaActionChipsComponent],
    templateUrl: './media-details.html',
    styleUrl: './media-details.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDetailsComponent {
    tmdbId = input<number | null>(null);
    mediaType = input<MediaType | null>(null);
    imdbId = input<string>('');
    jellyfinUrl = input<string | null>(null);
    detail = input<MovieDetailMetadata | null>(null);
    detailLoading = input<boolean>(false);
    sizeBytes = input<number | null>(null);

    protected displayFeedbackBtns = computed(() => !!this.tmdbId() && !!this.mediaType());

    protected sizeGb = computed(() => {
        const bytes = this.sizeBytes();
        if (!bytes) return null;
        return (bytes / 1_073_741_824).toFixed(2);
    });
}
