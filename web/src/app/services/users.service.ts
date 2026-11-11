import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import type { UserInfo } from '@rm/shared/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
    private api = inject(ApiService);

    async getUsers(): Promise<UserInfo[]> {
        return this.api.get<UserInfo[]>('/api/users');
    }

    async setUserValid(userId: number, valid: boolean): Promise<void> {
        await this.api.patch<void>(`/api/users/${userId}/valid`, { valid });
    }

    async deleteUser(userId: number): Promise<void> {
        await this.api.delete<void>(`/api/users/${userId}`);
    }

    async setUserAdmin(userId: number, admin: boolean): Promise<void> {
        await this.api.patch<void>(`/api/users/${userId}/admin`, { admin });
    }
}
