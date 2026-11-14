import {
    Component,
    ElementRef,
    afterNextRender,
    computed,
    input,
    linkedSignal,
    output,
    viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountMenuComponent } from '../account-menu/account-menu';

type SearchFilterValue = string | boolean;

interface SearchFilterOption {
    value: string;
    label: string;
}

export interface SearchFilterDefinition {
    key: string;
    label: string;
    control: 'select' | 'toggle';
    defaultValue: SearchFilterValue;
    options: SearchFilterOption[];
}

type SearchFilterValues = Record<string, SearchFilterValue>;

export interface FilterSearchSubmit {
    query: string;
    filters: SearchFilterValues;
}

@Component({
    selector: 'app-filter-search',
    imports: [MatButtonModule, MatIconModule, AccountMenuComponent],
    templateUrl: './filter-search.html',
    styleUrl: './filter-search.scss',
})
export class FilterSearchComponent {
    placeholder = input('Search…');
    filters = input<SearchFilterDefinition[]>([]);
    query = input('');
    values = input<SearchFilterValues>({});
    focusOnInit = input(false);
    searchSubmit = output<FilterSearchSubmit>();

    private field = viewChild.required<ElementRef<HTMLInputElement>>('field');
    protected searchQuery = linkedSignal(() => this.query());
    private selectedFilters = linkedSignal(() => this.values());

    protected filterValues = computed(() => ({
        ...Object.fromEntries(this.filters().map((filter) => [filter.key, filter.defaultValue])),
        ...this.selectedFilters(),
    }));

    constructor() {
        afterNextRender(() => {
            if (this.focusOnInit()) this.field().nativeElement.focus();
        });
    }

    protected submit(): void {
        this.field().nativeElement.blur();
        this.emitSearch();
    }

    protected clear(): void {
        this.searchQuery.set('');
        this.emitSearch();
        this.field().nativeElement.focus();
    }

    protected isOn(filter: SearchFilterDefinition, option: SearchFilterOption): boolean {
        const value = this.filterValues()[filter.key];
        return filter.control === 'toggle' ? value === true : value === option.value;
    }

    protected choose(filter: SearchFilterDefinition, option: SearchFilterOption): void {
        const value = filter.control === 'toggle' ? !this.isOn(filter, option) : option.value;
        this.selectedFilters.update((filters) => ({ ...filters, [filter.key]: value }));
        this.emitSearch();
    }

    private emitSearch(): void {
        this.searchSubmit.emit({ query: this.searchQuery(), filters: this.filterValues() });
    }
}
