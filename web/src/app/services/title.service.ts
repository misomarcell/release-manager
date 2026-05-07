import { Injectable, signal } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class TitleService {
    title = signal('');

    setTitle(value: string): void {
        this.title.set(value);
    }

    setTitleFromRoute(route: ActivatedRouteSnapshot): void {
        const title = this.findRouteTitle(route);
        if (title) this.setTitle(title);
    }

    private findRouteTitle(route: ActivatedRouteSnapshot): string | null {
        let current: ActivatedRouteSnapshot | null = route;
        let title: string | null = null;

        while (current) {
            const routeTitle = current.data['title'];
            if (typeof routeTitle === 'string' && routeTitle) title = routeTitle;
            current = current.firstChild;
        }

        return title;
    }
}
