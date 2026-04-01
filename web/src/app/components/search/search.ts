import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAccordion } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MovieCardComponent } from '../movie-card/movie-card';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { VersionService } from '../../services/version.service';
import { ActivatedRoute, Router } from '@angular/router';
import type { NcoreCategoryKey, NcoreResult } from '../../../../../shared/src/ncore.models';

const VALID_CATEGORIES: NcoreCategoryKey[] = ['all', 'movies', 'tv'];

export interface GroupedMovie {
  key: string;
  omdb: NcoreResult['omdb'];
  omdb_lookup: NcoreResult['omdb_lookup'];
  imdb_id: string;
  releases: NcoreResult[];
}

@Component({
  selector: 'app-search',
  imports: [
    FormsModule,
    DatePipe,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatAccordion,
    MatToolbarModule,
    MatProgressBarModule,
    MatPaginatorModule,
    MovieCardComponent,
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthService);
  protected version = inject(VersionService);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  private results = signal<NcoreResult[]>([]);
  protected totalResults = signal(0);
  protected currentPage = signal(1);
  protected readonly pageSize = 100;

  protected groupedMovies = computed(() => {
    const results = this.results();
    const groups = new Map<string, GroupedMovie>();
    for (const r of results) {
      const key = r.imdb_id || `${r.omdb_lookup.title}::${r.omdb_lookup.year}`;
      const existing = groups.get(key);
      if (existing) {
        existing.releases.push(r);
        if (!existing.omdb && r.omdb) {
          existing.omdb = r.omdb;
        }
      } else {
        groups.set(key, {
          key,
          omdb: r.omdb,
          omdb_lookup: r.omdb_lookup,
          imdb_id: r.imdb_id,
          releases: [r],
        });
      }
    }
    return [...groups.values()];
  });

  protected searchQuery = '';
  protected selectedCategory = signal<NcoreCategoryKey>('movies');
  protected uhdOnly = signal(true);
  private lastSearchTerm = signal('');

  protected listTitle = computed(() => {
    const term = this.lastSearchTerm();
    if (term) return `Results for: ${term}`;
    const cat = this.selectedCategory();
    if (cat === 'movies') return 'Top Movies';
    if (cat === 'tv') return 'Top TV Shows';
    return 'Top Releases';
  });

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

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const cat = params['category'];
    if (cat && VALID_CATEGORIES.includes(cat)) {
      this.selectedCategory.set(cat as NcoreCategoryKey);
    }
    if (params['q']) {
      this.searchQuery = params['q'];
    }
    if (params['uhd'] === 'false') {
      this.uhdOnly.set(false);
    }
    const page = parseInt(params['page'], 10);
    if (page > 0) {
      this.currentPage.set(page);
    }
    void this.loadResults();
  }

  protected onSearch(): void {
    this.currentPage.set(1);
    void this.loadResults();
  }

  protected onSearchByTitle(title: string): void {
    this.searchQuery = title;
    this.currentPage.set(1);
    void this.loadResults();
  }

  protected onPage(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    void this.loadResults();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  private async loadResults(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.syncQueryParams();

    try {
      const hasSearchTerm = !!this.searchQuery.trim();
      this.lastSearchTerm.set(this.searchQuery.trim());
      const response = await this.api.search(
        this.selectedCategory(),
        this.searchQuery,
        this.currentPage(),
        this.pageSize,
        !hasSearchTerm && this.uhdOnly(),
      );
      this.results.set(response.results);
      this.totalResults.set(response.totalResults);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Search failed');
      this.results.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private syncQueryParams(): void {
    const params: Record<string, string> = {};
    if (this.searchQuery.trim()) params['q'] = this.searchQuery.trim();
    if (this.selectedCategory() !== 'movies') params['category'] = this.selectedCategory();
    if (!this.uhdOnly()) params['uhd'] = 'false';
    if (this.currentPage() > 1) params['page'] = String(this.currentPage());
    this.router.navigate([], { queryParams: params, replaceUrl: true });
  }
}
