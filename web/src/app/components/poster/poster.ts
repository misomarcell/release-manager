import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { MediaType } from '@rm/shared/tmdb.models';

@Component({
    selector: 'app-poster',
    imports: [MatIconModule],
    templateUrl: './poster.html',
    styleUrl: './poster.scss',
})
export class PosterComponent {
    src = input<string | null>();
    mediaType = input<MediaType | null>();
    eager = input(false);
}
