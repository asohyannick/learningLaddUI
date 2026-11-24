import { ApiErrorResponse, isApiErrorResponse } from '../../core/interface';

/**
 * The API error behind a `resource()` / `rxResource()` error. Angular wraps thrown values that
 * are not `Error` instances (like our `ApiErrorResponse`) and keeps the original in `cause`.
 */
export function resourceApiError(error: unknown): ApiErrorResponse | null {
  if (isApiErrorResponse(error)) return error;
  const cause = (error as { cause?: unknown } | null | undefined)?.cause;
  return isApiErrorResponse(cause) ? cause : null;
}

/** The API's message for a resource error, or `fallback`. */
export function resourceErrorMessage(
  error: unknown,
  fallback = 'Please try again in a moment.',
): string {
  return resourceApiError(error)?.message ?? fallback;
}
