import { Component, ElementRef, afterRenderEffect, input, untracked, viewChild } from '@angular/core';
import { injectIsDesktop } from '../../utils/breakpoint';

@Component({
    selector: 'app-list-detail',
    templateUrl: './list-detail.html',
    styleUrl: './list-detail.scss',
    host: { '[class.open]': '!!openKey()', '[class.wide]': 'wide()' },
})
export class ListDetailComponent {
    openKey = input<string | null>(null);
    wide = input(false);

    protected isDesktop = injectIsDesktop();
    private list = viewChild.required<ElementRef<HTMLElement>>('list');
    private detail = viewChild.required<ElementRef<HTMLElement>>('detail');

    constructor() {
        afterRenderEffect(() => {
            if (!this.openKey()) return;
            const detail = this.detail().nativeElement;
            detail.scrollTop = 0;
            if (!untracked(this.isDesktop)) detail.focus({ preventScroll: true });
        });
    }

    scrollListToTop(): void {
        this.list().nativeElement.scrollTo({ top: 0 });
    }
}
