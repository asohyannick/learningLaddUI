import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../enum/global-enum-configuration';
import { AuthService } from '../service/auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).parseUrl(auth.dashboardPath()) : true;
};

export const magicLinkTokenGuard: CanActivateFn = (route) => {
  const token = route.queryParamMap.get('token') ?? route.queryParamMap.get('magicLinkToken');
  if (!token) {
    return true;
  }
  return inject(Router).createUrlTree(['/magic-link/verify'], {
    queryParams: route.queryParams,
  });
};

export function roleGuard(allowed: readonly UserRole[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    }
    return auth.hasAnyRole(allowed) ? true : router.parseUrl(auth.dashboardPath());
  };
}
