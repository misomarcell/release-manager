import { Component, computed, input } from '@angular/core';
import type { SeasonInfo } from '@rm/shared/jellyfin.models';

@Component({
    selector: 'app-season-summary',
    templateUrl: './season-summary.html',
    styleUrl: './season-summary.scss',
})
export class SeasonSummaryComponent {
    seasons = input.required<SeasonInfo[]>();

    protected episodeCount = computed(() => this.seasons().reduce((sum, season) => sum + season.episodeCount, 0));
}
