import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users').then((m) => m.UsersComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./components/admin/admin').then((m) => m.AdminComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadComponent: () => import('./components/home/home').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
