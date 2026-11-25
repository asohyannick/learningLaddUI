import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { ApiErrorResponse, isApiErrorResponse } from '../interface';
import { isApiRequest } from './api-url';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }
  return next(req).pipe(catchError((error: unknown) => toApiError$(error, req.url)));
};

function toApiError$(error: unknown, url: string): Observable<never> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    return from(error.error.text()).pipe(
      catchError(() => [''] as string[]),
      switchMap((text) => throwError(() => toApiError(withBody(error, parseJson(text)), url))),
    );
  }
  return throwError(() => toApiError(error, url));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withBody(error: HttpErrorResponse, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({
    error: body,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
}

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
