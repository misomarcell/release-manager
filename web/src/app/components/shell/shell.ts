import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { A11yModule } from '@angular/cdk/a11y';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { filter, timer } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { VersionService } from '../../services/version.service';
import { TitleService } from '../../services/title.service';
import { WatchlistService } from '../../services/watchlist.service';

const DESKTOP_BREAKPOINT = '(min-width: 960px)';
const WATCHLIST_REFRESH_MS = 5 * 60 * 1000;

@Component({
    selector: 'app-shell',
    imports: [
        RouterOutlet,
        RouterLink,
        RouterLinkActive,
        DatePipe,
        A11yModule,
        MatToolbarModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatDividerModule,
        MatBadgeModule,
    ],
    templateUrl: './shell.html',
    styleUrl: './shell.scss',
})
export class ShellComponent implements OnInit {
    private router = inject(Router);
    private activatedRoute = inject(ActivatedRoute);
    private breakpointObserver = inject(BreakpointObserver);
    private destroyRef = inject(DestroyRef);
    protected auth = inject(AuthService);
    protected version = inject(VersionService);
    protected pageTitle = inject(TitleService);
    protected watchlist = inject(WatchlistService);
    protected isDesktop = signal(false);
    protected mobileOpen = signal(false);
    private previousPath = '';

    ngOnInit(): void {
        this.previousPath = urlPath(this.router.url);
        this.breakpointObserver
            .observe(DESKTOP_BREAKPOINT)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((state) => {
                this.isDesktop.set(state.matches);
                if (state.matches) {
                    this.mobileOpen.set(false);
                }
            });
        this.setTitleFromRoute();
        timer(0, WATCHLIST_REFRESH_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => void this.watchlist.load());
        this.router.events
            .pipe(
                filter((e): e is NavigationEnd => e instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((e) => {
                const path = urlPath(e.urlAfterRedirects);
                if (path !== this.previousPath) {
                    this.setTitleFromRoute();
                }
                this.previousPath = path;
            });
    }

    private setTitleFromRoute(): void {
        this.pageTitle.setTitleFromRoute(this.activatedRoute.snapshot);
    }

    protected toggleSidenav(): void {
        this.mobileOpen.update((v) => !v);
    }

    protected closeSidenav(): void {
        this.mobileOpen.set(false);
    }

    protected async logout(): Promise<void> {
        await this.auth.logout();
        void this.router.navigate(['/login']);
    }
}

function urlPath(url: string): string {
    return url.split(/[?#]/)[0];
}
