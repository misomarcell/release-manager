import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import type { LibraryResponse } from '@rm/shared/jellyfin.models';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private api = inject(ApiService);

  async getLibrary(search = '', page = 1, perPage = 30): Promise<LibraryResponse> {
    let params = new HttpParams().set('page', page.toString()).set('perPage', perPage.toString());
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.api.get<LibraryResponse>('/api/library', params);
  }
}
