import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface VersionInfo {
  commitHash: string;
  commitUrl: string;
  commitDate: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  commitHash = signal('');
  commitUrl = signal('');
  commitDate = signal('');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    try {
      const info = await firstValueFrom(this.http.get<VersionInfo>('/api/version'));
      this.commitHash.set(info.commitHash);
      this.commitUrl.set(info.commitUrl);
      this.commitDate.set(info.commitDate);
    } catch {
      // Version endpoint unavailable — silently ignore
    }
  }
}
