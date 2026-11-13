import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import type { SettingsResponse, SettingsUpdateRequest } from '@rm/shared/settings.models';

const SETTINGS_URL = '/api/admin/settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private api = inject(ApiService);

    settings = signal<SettingsResponse | null>(null);

    async load(): Promise<void> {
        this.settings.set(await this.api.get<SettingsResponse>(SETTINGS_URL));
    }

    /** Saves the given values; the backend applies them right away and answers with the new state. */
    async update(values: SettingsUpdateRequest['values']): Promise<void> {
        const body: SettingsUpdateRequest = { values };
        this.settings.set(await this.api.put<SettingsResponse>(SETTINGS_URL, body));
    }
}
