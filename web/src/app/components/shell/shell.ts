import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
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
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { VersionService } from '../../services/version.service';
import { TitleService } from '../../services/title.service';

const DESKTOP_BREAKPOINT = '(min-width: 960px)';

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
    ],
    templateUrl: './shell.html',
    styleUrl: './shell.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit, OnDestroy {
    private router = inject(Router);
    private activatedRoute = inject(ActivatedRoute);
    private breakpointObserver = inject(BreakpointObserver);
    protected auth = inject(AuthService);
    protected version = inject(VersionService);
    protected pageTitle = inject(TitleService);
    protected isDesktop = signal(false);
    protected mobileOpen = signal(false);
    private bpSub!: Subscription;
    private previousUrl = '';

    ngOnInit(): void {
        this.previousUrl = this.router.url;
        this.bpSub = this.breakpointObserver.observe(DESKTOP_BREAKPOINT).subscribe((state) => {
            this.isDesktop.set(state.matches);
            if (state.matches) {
                this.mobileOpen.set(false);
            }
        });
        this.setTitleFromRoute();
        this.bpSub.add(
            this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
                if (e.urlAfterRedirects !== this.previousUrl) {
                    this.setTitleFromRoute();
                }
                this.previousUrl = e.urlAfterRedirects;
            }),
        );
    }

    ngOnDestroy(): void {
        this.bpSub.unsubscribe();
    }

    private setTitleFromRoute(): void {
        let route = this.activatedRoute.snapshot;
        while (route.firstChild) route = route.firstChild;
        const title = route.data['title'];
        if (title) this.pageTitle.setTitle(title as string);
    }

    protected toggleSidenav(): void {
        this.mobileOpen.update((v) => !v);
    }

    protected closeSidenav(): void {
        this.mobileOpen.set(false);
    }

    protected async logout(): Promise<void> {
        await this.auth.logout();
        this.router.navigate(['/login']);
    }
}
