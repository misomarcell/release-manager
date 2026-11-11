import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
    },
    {
        path: '',
        loadComponent: () => import('./components/shell/shell').then((m) => m.ShellComponent),
        canActivate: [authGuard],
        children: [
            {
                path: '',
                redirectTo: 'releases',
                pathMatch: 'full',
            },
            {
                path: 'releases',
                title: 'Releases',
                loadComponent: () => import('./components/releases/releases').then((m) => m.ReleasesComponent),
            },
            {
                path: 'library',
                title: 'Library',
                loadComponent: () => import('./components/library/library').then((m) => m.LibraryComponent),
            },
            {
                path: 'watchlist',
                title: 'Watchlist',
                loadComponent: () => import('./components/watchlist/watchlist').then((m) => m.WatchlistComponent),
            },
            {
                path: 'discover',
                title: 'Discover',
                loadComponent: () => import('./components/discover/discover').then((m) => m.DiscoverComponent),
            },
            {
                path: 'recommendations',
                redirectTo: 'discover',
            },
            {
                path: 'users',
                title: 'Manage Users',
                loadComponent: () => import('./components/users/users').then((m) => m.UsersComponent),
                canActivate: [adminGuard],
            },
            {
                path: 'admin',
                title: 'Administration',
                loadComponent: () => import('./components/admin/admin').then((m) => m.AdminComponent),
                canActivate: [adminGuard],
            },
            {
                path: 'logs',
                title: 'Logs',
                loadComponent: () => import('./components/logs/logs').then((m) => m.LogsComponent),
                canActivate: [adminGuard],
            },
        ],
    },
    {
        path: '**',
        redirectTo: 'releases',
    },
];
