import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';

export type SearchFilterValue = string | boolean;

export interface SearchFilterOption {
    value: string;
    label: string;
}

export interface SearchFilterDefinition {
    key: string;
    label: string;
    control: 'select' | 'toggle';
    defaultValue: SearchFilterValue;
    options?: SearchFilterOption[];
}

export type SearchFilterValues = Record<string, SearchFilterValue>;

export interface FilterSearchSubmit {
    query: string;
    filters: SearchFilterValues;
}

@Component({
    selector: 'app-filter-search',
    imports: [
        FormsModule,
        MatBadgeModule,
        MatButtonModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
    ],
    templateUrl: './filter-search.html',
    styleUrl: './filter-search.scss',
})
export class FilterSearchComponent {
    placeholder = input('Search...');
    filters = input<SearchFilterDefinition[]>([]);
    query = input('');
    values = input<SearchFilterValues>({});
    searchSubmit = output<FilterSearchSubmit>();

    protected searchQuery = linkedSignal(() => this.query());
    private selectedFilters = linkedSignal(() => this.values());

    protected filterValues = computed(() => ({
        ...this.defaultFilterValues(),
        ...this.selectedFilters(),
    }));

    protected activeFilterCount = computed(() =>
        this.filters().filter((filter) => this.isFilterActive(filter)).length,
    );

    setQuery(query: string): void {
        this.searchQuery.set(query);
        this.emitSearch();
    }

    protected onSearch(): void {
        this.emitSearch();
    }

    protected clearAndSearch(): void {
        this.searchQuery.set('');
        this.emitSearch();
    }

    protected selectedValue(key: string): SearchFilterValue {
        return this.filterValues()[key];
    }

    protected onSelectFilter(key: string, value: string): void {
        this.setFilterValue(key, value);
        this.emitSearch();
    }

    protected onToggleFilter(event: MouseEvent, filter: SearchFilterDefinition): void {
        event.stopPropagation();
        this.setFilterValue(filter.key, this.selectedValue(filter.key) !== true);
        this.emitSearch();
    }

    private setFilterValue(key: string, value: SearchFilterValue): void {
        this.selectedFilters.update((filters) => ({ ...filters, [key]: value }));
    }

    private emitSearch(): void {
        this.searchSubmit.emit({
            query: this.searchQuery(),
            filters: this.filterValues(),
        });
    }

    private isFilterActive(filter: SearchFilterDefinition): boolean {
        const value = this.selectedValue(filter.key);
        return filter.control === 'toggle' ? value === true : value !== filter.defaultValue;
    }

    private defaultFilterValues(): SearchFilterValues {
        return Object.fromEntries(this.filters().map((filter) => [filter.key, filter.defaultValue]));
    }
}
