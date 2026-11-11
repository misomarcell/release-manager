import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PosterComponent } from '../../poster/poster';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-ribbon',
    imports: [RouterLink, MatIconModule, PosterComponent],
    templateUrl: './ribbon.html',
    styleUrl: './ribbon.scss',
})
export class RibbonComponent {
    heading = input.required<string>();
    icon = input.required<string>();
    items = input.required<Recommendation[]>();
    loading = input(false);
    canRefresh = input(false);
    selectedKey = input<string | null>(null);
    refresh = output<void>();

    protected skeletons = [0, 1, 2, 3, 4];
}
