import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const authenticated = await authService.checkSession();
  if (!authenticated) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};
