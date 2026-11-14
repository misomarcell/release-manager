import {
    afterRenderEffect,
    Component,
    computed,
    ElementRef,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PosterComponent } from '../../poster/poster';
import { WatchlistService } from '../../../services/watchlist.service';
import type { Recommendation } from '@rm/shared/recommendations.models';

@Component({
    selector: 'app-ribbon',
    imports: [RouterLink, MatIconModule, PosterComponent],
    templateUrl: './ribbon.html',
    styleUrl: './ribbon.scss',
    host: { '(window:resize)': 'measure()' },
})
export class RibbonComponent {
    protected watchlist = inject(WatchlistService);

    heading = input.required<string>();
    icon = input.required<string>();
    items = input.required<Recommendation[]>();
    note = input('');
    hint = input('');
    loading = input(false);
    canRefresh = input(false);
    selectedKey = input<string | null>(null);
    refresh = output<void>();

    protected skeletons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    protected empty = computed(() => !this.loading() && this.items().length === 0);
    protected atStart = signal(true);
    protected atEnd = signal(true);
    protected scrollable = computed(() => !this.atStart() || !this.atEnd());

    private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

    constructor() {
        afterRenderEffect({
            read: () => {
                this.items();
                this.loading();
                this.selectedKey();
                this.measure();
            },
        });
    }

    protected measure(): void {
        const element = this.scroller()?.nativeElement;
        this.atStart.set(!element || element.scrollLeft <= 1);
        this.atEnd.set(!element || element.scrollLeft + element.clientWidth >= element.scrollWidth - 1);
    }

    protected page(direction: 1 | -1): void {
        const element = this.scroller()?.nativeElement;
        element?.scrollBy({ left: direction * element.clientWidth * 0.8 });
    }
}
