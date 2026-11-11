import { Component, computed, input } from '@angular/core';

@Component({
    selector: 'app-row-skeletons',
    templateUrl: './row-skeletons.html',
    styleUrl: './row-skeletons.scss',
    host: { class: 'seg-list', 'aria-busy': 'true', 'aria-label': 'Loading' },
})
export class RowSkeletonsComponent {
    count = input(6);
    protected rows = computed(() => Array.from({ length: this.count() }, (_, index) => index));
}
