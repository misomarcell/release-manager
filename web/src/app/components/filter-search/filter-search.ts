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

interface SearchFilterOption {
    value: string;
    label: string;
}

/** A group of chips: `select` always has exactly one option on, `toggle` any number of them. */
export type SearchFilterDefinition =
    | { key: string; control: 'select'; defaultValue: string; options: SearchFilterOption[] }
    | { key: string; control: 'toggle'; options: SearchFilterOption[] };

// The chosen option of a `select`, the options that are on for a `toggle`.
type SearchFilterValue = string | string[];

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

    protected filterValues = computed<SearchFilterValues>(() => ({
        ...Object.fromEntries(
            this.filters().map((filter) => [filter.key, filter.control === 'select' ? filter.defaultValue : []]),
        ),
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
        return Array.isArray(value) ? value.includes(option.value) : value === option.value;
    }

    protected choose(filter: SearchFilterDefinition, option: SearchFilterOption): void {
        const value = filter.control === 'select' ? option.value : this.toggled(filter, option);
        this.selectedFilters.update((filters) => ({ ...filters, [filter.key]: value }));
        this.emitSearch();
    }

    private toggled(filter: SearchFilterDefinition, option: SearchFilterOption): string[] {
        return filter.options
            .filter((candidate) => this.isOn(filter, candidate) !== (candidate === option))
            .map((candidate) => candidate.value);
    }

    private emitSearch(): void {
        this.searchSubmit.emit({ query: this.searchQuery(), filters: this.filterValues() });
    }
}
