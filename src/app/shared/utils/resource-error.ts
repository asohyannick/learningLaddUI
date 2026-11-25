import { ApiErrorResponse, isApiErrorResponse } from '../../core/interface';

export function resourceApiError(error: unknown): ApiErrorResponse | null {
  if (isApiErrorResponse(error)) return error;
  const cause = (error as { cause?: unknown } | null | undefined)?.cause;
  return isApiErrorResponse(cause) ? cause : null;
}

export function resourceErrorMessage(
  error: unknown,
  fallback = 'Please try again in a moment.',
): string {
  return resourceApiError(error)?.message ?? fallback;
}
