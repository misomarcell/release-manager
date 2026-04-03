import { ChangeDetectionStrategy, Component, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NcoreCategoryKey } from '@rm/shared/ncore.models';

export interface SearchParams {
  query: string;
  category: NcoreCategoryKey;
  uhdOnly: boolean;
}

@Component({
  selector: 'app-release-search',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatSlideToggleModule,
  ],
  templateUrl: './release-search.html',
  styleUrl: './release-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReleaseSearchComponent {
  searchSubmit = output<SearchParams>();

  protected searchQuery = '';
  protected selectedCategory = signal<NcoreCategoryKey>('all');
  protected uhdOnly = signal(true);

  protected activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedCategory() !== 'all') count++;
    if (this.uhdOnly()) count++;
    return count;
  });

  protected categories: { key: NcoreCategoryKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'tv', label: 'TV Shows' },
  ];

  setQuery(query: string): void {
    this.searchQuery = query;
    this.emitSearch();
  }

  setCategory(category: NcoreCategoryKey): void {
    this.selectedCategory.set(category);
  }

  setUhdOnly(uhd: boolean): void {
    this.uhdOnly.set(uhd);
  }

  protected onSearch(): void {
    this.emitSearch();
  }

  protected onCategorySelect(key: NcoreCategoryKey): void {
    this.selectedCategory.set(key);
    this.emitSearch();
  }

  protected onUhdToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.uhdOnly.set(!this.uhdOnly());
    this.emitSearch();
  }

  protected clearAndSearch(): void {
    this.searchQuery = '';
    this.emitSearch();
  }

  private emitSearch(): void {
    this.searchSubmit.emit({
      query: this.searchQuery,
      category: this.selectedCategory(),
      uhdOnly: this.uhdOnly(),
    });
  }
}
