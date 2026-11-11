import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PosterComponent } from '../poster/poster';
import type { MediaType } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-title-row',
    imports: [RouterLink, MatIconModule, PosterComponent],
    templateUrl: './title-row.html',
    styleUrl: './title-row.scss',
    host: { class: 'tile', '[class.selected]': 'selected()' },
})
export class TitleRowComponent {
    key = input.required<string>();
    title = input.required<string>();
    poster = input<string | null>();
    mediaType = input<MediaType | null>();
    year = input<string | null>();
    rating = input<string | null>();
    info = input<string | null>();
    selected = input(false);
    replaceUrl = input(false);
}
