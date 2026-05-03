import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TitleService {
    title = signal('');

    setTitle(value: string): void {
        this.title.set(value);
    }
}
