import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { SeasonInfo } from '@rm/shared/jellyfin.models';

@Component({
    selector: 'app-season-summary',
    imports: [MatIconModule],
    templateUrl: './season-summary.html',
    styleUrl: './season-summary.scss',
})
export class SeasonSummaryComponent {
    seasons = input.required<SeasonInfo[]>();

    protected seasonCount = computed(() => this.seasons().filter((s) => s.seasonNumber > 0).length);
    protected episodeCount = computed(() => this.seasons().reduce((sum, s) => sum + s.episodeCount, 0));

    protected seasonLabel(season: SeasonInfo): string {
        return season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`;
    }
}
