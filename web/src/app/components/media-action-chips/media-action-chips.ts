import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-media-action-chips',
    imports: [MatIconModule],
    templateUrl: './media-action-chips.html',
    styleUrl: './media-action-chips.scss',
})
export class MediaActionChipsComponent {
    imdbId = input<string | undefined>(undefined);
    trailerKey = input<string | undefined>(undefined);
    jellyfinUrl = input<string | null | undefined>(undefined);
}
