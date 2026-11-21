/** Every successful API call is wrapped in this envelope (`APISuccessResponse` in Swagger). */
export interface ApiResponse<T> {
  success: true;
  status: number;
  /** Human-readable and safe to show in the UI. */
  message: string;
  data: T;
  path: string;
  timestamp: string;
}

/** One entry of `errors[]` on a 400 validation failure. */
export interface FieldValidationError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

/** Every failed API call returns this shape (`APIErrorResponse` in Swagger). */
export interface ApiErrorResponse {
  success: false;
  status: number;
  error: string;
  /** e.g. `BAD_REQUEST`, `ACCESS_DENIED`. `NETWORK_ERROR` / `UNKNOWN_ERROR` are added by the UI. */
  errorCode: string;
  message: string;
  errors?: FieldValidationError[];
  path: string;
  timestamp: string;
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<ApiErrorResponse>).success === false &&
    typeof (value as Partial<ApiErrorResponse>).status === 'number' &&
    typeof (value as Partial<ApiErrorResponse>).message === 'string'
  );
}
