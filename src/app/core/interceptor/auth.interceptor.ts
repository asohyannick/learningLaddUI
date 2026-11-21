import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../service/auth/auth.service';
import { isApiRequest, isPublicAuthRequest } from './api-url';

/**
 * 1. Adds `Authorization: Bearer <accessToken>` to API requests (never to third-party URLs).
 * 2. On a 401, refreshes the token once (shared by parallel requests) and retries the request.
 * 3. If the refresh fails, ends the session and redirects to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const sentToken = auth.accessToken();

  return next(withBearer(req, sentToken)).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse &&
        error.status === HttpStatusCode.Unauthorized &&
        !isPublicAuthRequest(req.url) &&
        auth.isAuthenticated();
      if (!canRefresh) {
        return throwError(() => error);
      }

      // Another request already renewed the token while this one was in flight: just retry.
      const currentToken = auth.accessToken();
      if (currentToken && currentToken !== sentToken) {
        return next(withBearer(req, currentToken));
      }

      return auth.refreshAccessToken().pipe(
        catchError(() => {
          auth.endSession();
          return throwError(() => error);
        }),
        switchMap((newToken) => next(withBearer(req, newToken))),
      );
    }),
  );
};

function withBearer<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
