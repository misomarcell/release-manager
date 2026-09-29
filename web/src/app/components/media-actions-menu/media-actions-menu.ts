import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

@Component({
    selector: 'app-media-actions-menu',
    imports: [MatButtonModule, MatIconModule, MatDividerModule, MatMenuModule],
    templateUrl: './media-actions-menu.html',
    styleUrl: './media-actions-menu.scss',
})
export class MediaActionsMenuComponent {
    title = input<string>('');
    imdbId = input<string | undefined>();
    trailerKey = input<string | undefined>();
    jellyfinUrl = input<string | undefined>();
    canBeDeleted = input<boolean>(false);
    deleteActionDisabled = input<boolean>(false);
    deleteAction = output<void>();

    protected wokeUrl = computed(() =>
        this.title() ? `https://isitwokeornot.com/search?q=${encodeURIComponent(this.title())}` : null,
    );
}
