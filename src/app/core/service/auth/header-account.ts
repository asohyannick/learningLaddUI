import { Signal, computed, inject } from '@angular/core';
import { HeaderAccount } from '../../../shared/reusable-components/site-header/site-header';
import { AuthService } from './auth.service';

/** For pages with `<app-site-header [account]="account()" />`: null while signed out. */
export function injectHeaderAccount(): Signal<HeaderAccount | null> {
  const auth = inject(AuthService);
  return computed(() => (auth.isAuthenticated() ? { dashboardPath: auth.dashboardPath() } : null));
}
