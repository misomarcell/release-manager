import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FilterStateStorage {
    read<T>(key: string, isValid: (value: unknown) => value is T): T | null {
        const storage = this.getStorage();
        if (!storage) {
            return null;
        }

        const raw = storage.getItem(key);
        if (!raw) {
            return null;
        }

        try {
            const parsed: unknown = JSON.parse(raw);
            if (isValid(parsed)) {
                return parsed;
            }
        } catch {
            storage.removeItem(key);
            return null;
        }

        storage.removeItem(key);
        return null;
    }

    write(key: string, value: unknown): void {
        const storage = this.getStorage();
        if (!storage) {
            return;
        }

        try {
            storage.setItem(key, JSON.stringify(value));
        } catch {
            return;
        }
    }

    remove(key: string): void {
        const storage = this.getStorage();
        if (!storage) {
            return;
        }

        storage.removeItem(key);
    }

    private getStorage(): Storage | null {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            return window.localStorage;
        } catch {
            return null;
        }
    }
}
