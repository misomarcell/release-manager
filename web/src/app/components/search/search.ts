import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MovieCardComponent } from '../movie-card/movie-card';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import type { NcoreCategoryKey, NcoreResult } from '../../../../../shared/src/ncore.models';

@Component({
  selector: 'app-search',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatPaginatorModule,
    MovieCardComponent,
  ],
  template: `
    <mat-toolbar color="primary" class="toolbar">
      <span class="toolbar-title">MovieReleases</span>
      <span class="spacer"></span>
      <span class="user-info">{{ auth.username() }}</span>
      <button mat-icon-button (click)="logout()" aria-label="Sign out">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <main class="container">
      <div class="search-bar">
        <mat-form-field appearance="outline" class="search-input">
          <mat-label>Search</mat-label>
          <input
            matInput
            [(ngModel)]="searchQuery"
            (keydown.enter)="onSearch()"
            placeholder="Movie or TV show name..."
          />
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" class="category-select">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="selectedCategory" (selectionChange)="onSearch()">
            @for (cat of categories; track cat.key) {
              <mat-option [value]="cat.key">{{ cat.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button (click)="onSearch()" [disabled]="loading()">
          <mat-icon>search</mat-icon>
          Search
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (error(); as err) {
        <p class="error">{{ err }}</p>
      }

      @if (results().length > 0) {
        <div class="results">
          @for (torrent of results(); track torrent.torrent_id; let i = $index) {
            <app-movie-card [torrent]="torrent" [index]="pageOffset() + i + 1" />
          }
        </div>

        <mat-paginator
          [length]="totalResults()"
          [pageSize]="pageSize"
          [pageIndex]="currentPage() - 1"
          [pageSizeOptions]="[15]"
          (page)="onPage($event)"
          showFirstLastButtons
          aria-label="Page selector"
        />
      } @else if (!loading() && !error()) {
        <p class="empty">No results found.</p>
      }
    </main>
  `,
  styles: `
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .toolbar-title {
      font-weight: 600;
    }
    .spacer {
      flex: 1;
    }
    .user-info {
      font-size: 0.85rem;
      margin-right: 0.5rem;
      color: var(--mat-sys-on-primary);
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 1rem;
    }
    .search-bar {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
    .search-input {
      flex: 1;
      min-width: 200px;
    }
    .category-select {
      min-width: 140px;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .results {
      display: flex;
      flex-direction: column;
    }
    .empty {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 2rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  protected auth = inject(AuthService);

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
