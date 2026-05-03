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
                data: { title: 'Top Releases' },
                loadComponent: () => import('./components/home/home').then((m) => m.HomeComponent),
            },
            {
                path: 'library',
                data: { title: 'My Library' },
                loadComponent: () => import('./components/library/library').then((m) => m.LibraryComponent),
            },
            {
                path: 'recommendations',
                data: { title: 'Recommended for You' },
                loadComponent: () =>
                    import('./components/recommendations/recommendations').then((m) => m.RecommendationsComponent),
            },
            {
                path: 'users',
                data: { title: 'Manage Users' },
                loadComponent: () => import('./components/users/users').then((m) => m.UsersComponent),
                canActivate: [adminGuard],
            },
            {
                path: 'admin',
                data: { title: 'Administration' },
                loadComponent: () => import('./components/admin/admin').then((m) => m.AdminComponent),
                canActivate: [adminGuard],
            },
            {
                path: 'logs',
                data: { title: 'Logs' },
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
