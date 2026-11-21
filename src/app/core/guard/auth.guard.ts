import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../enum/global-enum-configuration';
import { AuthService } from '../service/auth/auth.service';

// These guards only improve the UX. The backend enforces every permission again.

/** Signed-in users only. Others go to /login and come back afterwards via `returnUrl`. */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Signed-out users only (login, register...). Signed-in users go to their dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.dashboardPath()) : true;
};

/**
 * The magic-link email points to `/magic-link?token=…`. With a token, go straight to
 * `/magic-link/verify` (same query) so the user is signed in instead of seeing the request form.
 */
export const magicLinkTokenGuard: CanActivateFn = (route) => {
  const token = route.queryParamMap.get('token') ?? route.queryParamMap.get('magicLinkToken');
  if (!token) {
    return true;
  }
  return inject(Router).createUrlTree(['/magic-link/verify'], {
    queryParams: route.queryParams,
  });
};

/** Signed-in users with at least one of the given roles. */
export function roleGuard(allowed: readonly UserRole[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    // Wrong role: send the user to the dashboard they are allowed to see.
    return auth.hasAnyRole(allowed) ? true : router.parseUrl(auth.dashboardPath());
  };
}
