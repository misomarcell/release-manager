import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { distinctUntilChanged, filter, map, skip, timer } from 'rxjs';
import { AccountMenuComponent } from '../account-menu/account-menu';
import { WatchlistService } from '../../services/watchlist.service';

const WATCHLIST_REFRESH_MS = 5 * 60 * 1000;

interface NavItem {
    path: string;
    icon: string;
    label: string;
    showsUnread?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/releases', icon: 'new_releases', label: 'Releases' },
    { path: '/library', icon: 'video_library', label: 'Library' },
    { path: '/watchlist', icon: 'bookmarks', label: 'Watchlist', showsUnread: true },
    { path: '/discover', icon: 'explore', label: 'Discover' },
];

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, AccountMenuComponent],
    templateUrl: './shell.html',
    styleUrl: './shell.scss',
})
export class ShellComponent implements OnInit {
    private destroyRef = inject(DestroyRef);
    protected watchlist = inject(WatchlistService);
    protected navItems = NAV_ITEMS;

    constructor() {
        inject(Router)
            .events.pipe(
                filter((event) => event instanceof NavigationEnd),
                map((event) => event.urlAfterRedirects.split('?')[0]),
                distinctUntilChanged(),
                skip(1),
                takeUntilDestroyed(),
            )
            .subscribe(() => window.scrollTo({ top: 0 }));
    }

    ngOnInit(): void {
        timer(0, WATCHLIST_REFRESH_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => void this.watchlist.load());
    }
}
