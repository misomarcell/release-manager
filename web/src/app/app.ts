import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import type { NcoreCategoryKey, NcoreSearchResponse } from '../../../shared/src/ncore.models';

const FIREBASE_PROJECT_ID = 'example-project';
const FIREBASE_FUNCTIONS_REGION = 'europe-west1';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private http = inject(HttpClient);

  protected query = signal('');
  protected category = signal<NcoreCategoryKey>('all');
  protected isLoading = signal(false);
  protected error = signal<string | null>(null);
  protected response = signal<NcoreSearchResponse | null>(null);

  protected categoryOptions: { key: NcoreCategoryKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'movies', label: 'Movies' },
    { key: 'tv', label: 'TV' },
    { key: 'music', label: 'Music' },
    { key: 'games', label: 'Games' },
    { key: 'software', label: 'Software' },
    { key: 'books', label: 'Books' },
  ];

  private getApiBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return `http://127.0.0.1:5001/${FIREBASE_PROJECT_ID}/${FIREBASE_FUNCTIONS_REGION}`;
    }

    return `https://${FIREBASE_FUNCTIONS_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net`;
  }

  protected async search(): Promise<void> {
    const normalizedQuery = this.query().trim();
    if (!normalizedQuery) {
      this.error.set('Type a search query first.');
      this.response.set(null);
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const apiResponse = await firstValueFrom(
        this.http.get<NcoreSearchResponse>(`${this.getApiBaseUrl()}/ncoreSearch`, {
          params: {
            query: normalizedQuery,
            category: this.category(),
          },
        }),
      );
      this.response.set(apiResponse);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        const apiError = error.error as { error?: string } | undefined;
        this.error.set(apiError?.error ?? error.message ?? 'Search request failed.');
      } else {
        this.error.set(error instanceof Error ? error.message : 'Search request failed.');
      }
      this.response.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected formattedData(): string {
    const searchResponse = this.response();
    if (!searchResponse) {
      return '';
    }

    return JSON.stringify(searchResponse.data, null, 2);
  }
}
