import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptor/auth.interceptor';
import { errorInterceptor } from './core/interceptor/error.interceptor';
import { AuthService } from './core/service/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Scroll to `#fragment` links (e.g. /#platform) and back to the top on page change.
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    // Order matters: errorInterceptor is outermost, so it maps the final error after the auth retry.
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
    // A reload loses the in-memory access token: renew it in the background (does not block start-up).
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
