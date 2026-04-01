import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { NcoreCategoryKey, NcoreSearchResponse } from '../../../../shared/src/ncore.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  async search(
    category: NcoreCategoryKey = 'movies',
    search = '',
    page = 1,
    perPage = 15,
  ): Promise<NcoreSearchResponse> {
    let params = new HttpParams()
      .set('category', category)
      .set('page', page.toString())
      .set('perPage', perPage.toString());

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return firstValueFrom(
      this.http.get<NcoreSearchResponse>('/api/search', { params, withCredentials: true }),
    );
  }
}
