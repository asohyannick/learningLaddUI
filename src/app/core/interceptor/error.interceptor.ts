import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiErrorResponse, isApiErrorResponse } from '../interface';
import { isApiRequest } from './api-url';

/**
 * Turns every failed API call into an `ApiErrorResponse`, so components can always read
 * `err.message` and `err.errors` (field errors), whatever went wrong.
 * Registered first so it sees the final error, after the auth interceptor's retry.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }
  return next(req).pipe(
    catchError((error: unknown) => throwError(() => toApiError(error, req.url))),
  );
};

export function toApiError(error: unknown, url: string): ApiErrorResponse {
  if (error instanceof HttpErrorResponse && isApiErrorResponse(error.error)) {
    return error.error;
  }

  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const offline = status === 0;
  return {
    success: false,
    status,
    error: error instanceof HttpErrorResponse ? error.statusText : 'Unknown Error',
    errorCode: offline ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
    message: offline
      ? 'Unable to reach the server. Check your connection and try again.'
      : 'Something went wrong. Please try again.',
    path: url,
    timestamp: new Date().toISOString(),
  };
}
