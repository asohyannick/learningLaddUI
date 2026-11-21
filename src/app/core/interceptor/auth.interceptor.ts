import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { AuthService, isSessionRejected } from '../service/auth/auth.service';
import { isApiRequest, isPublicAuthRequest } from './api-url';

/**
 * 1. Adds `Authorization: Bearer <accessToken>` to API requests (never to third-party URLs).
 *    If the token is being renewed (or is missing after a reload), the request waits for it.
 * 2. On a 401, refreshes the token once (shared by parallel requests) and retries the request.
 * 3. If the server rejects the refresh token, ends the session and redirects to /login.
 *    Temporary failures (offline, 5xx) keep the session; the request just fails.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const publicAuth = isPublicAuthRequest(req.url);
  const token$ = publicAuth ? of(auth.accessToken()) : auth.ensureAccessToken();

  return token$.pipe(
    switchMap((sentToken) =>
      next(withBearer(req, sentToken)).pipe(
        catchError((error: unknown) => {
          const canRefresh =
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.Unauthorized &&
            !publicAuth &&
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
            catchError((refreshError: unknown) => {
              if (isSessionRejected(refreshError)) {
                auth.expireSession();
              }
              return throwError(() => error);
            }),
            switchMap((newToken) => next(withBearer(req, newToken))),
          );
        }),
      ),
    ),
  );
};

function withBearer<T>(req: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
