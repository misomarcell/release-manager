import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const authenticated = await authService.checkSession();
  if (!authenticated) {
    router.navigate(['/login']);
    return false;
  }
  if (!authService.admin()) {
    router.navigate(['/']);
    return false;
  }
  return true;
};
