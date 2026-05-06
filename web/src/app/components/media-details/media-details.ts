import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { FeedbackButtonsComponent } from '../feedback-buttons/feedback-buttons';
import type { MovieDetailMetadata } from '@rm/shared/tmdb.models';
import type { MediaType } from '@rm/shared/tmdb.models';
import { MatDividerModule } from '@angular/material/divider';

@Component({
    selector: 'app-media-details',
    imports: [MatButtonModule, MatIconModule, MatDividerModule, MatMenuModule, FeedbackButtonsComponent],
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
    deleteActionDisabled = input<boolean>(false);
    canBeDeleted = input<boolean>(false);
    deleteAction = output<void>();

    protected displayFeedbackBtns = computed(() => !!this.tmdbId() && !!this.mediaType());
    protected hasDetailStrip = computed(
        () => !!this.mediaType() || !!this.detail()?.rated || !!this.detail()?.runtime || !!this.detail()?.releaseDate,
    );
    protected hasActionLinks = computed(() => !!this.imdbId() || !!this.detail()?.trailerKey || !!this.jellyfinUrl());
    protected hasMenuActions = computed(() => this.hasActionLinks());
}
