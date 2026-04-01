import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MovieCardComponent } from '../movie-card/movie-card';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { VersionService } from '../../services/version.service';
import { Router } from '@angular/router';
import type { NcoreCategoryKey, NcoreResult } from '../../../../../shared/src/ncore.models';

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
  protected auth = inject(AuthService);
  protected version = inject(VersionService);

  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected results = signal<NcoreResult[]>([]);
  protected totalResults = signal(0);
  protected currentPage = signal(1);
  protected pageOffset = signal(0);
  protected readonly pageSize = 15;

  protected searchQuery = '';
  protected selectedCategory: NcoreCategoryKey = 'movies';

  protected categories: { key: NcoreCategoryKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'tv', label: 'TV Shows' },
    { key: 'music', label: 'Music' },
    { key: 'games', label: 'Games' },
    { key: 'software', label: 'Software' },
    { key: 'books', label: 'Books' },
  ];

  ngOnInit(): void {
    void this.loadResults();
  }

  protected onSearch(): void {
    this.currentPage.set(1);
    void this.loadResults();
  }

  protected onPage(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    void this.loadResults();
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  private async loadResults(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.api.search(
        this.selectedCategory,
        this.searchQuery,
        this.currentPage(),
        this.pageSize,
      );
      this.results.set(response.results);
      this.totalResults.set(response.totalResults);
      this.pageOffset.set((this.currentPage() - 1) * this.pageSize);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Search failed');
      this.results.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
