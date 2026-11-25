export interface ApiResponse<T> {
  success: true;
  status: number;
  message: string;
  data: T;
  path: string;
  timestamp: string;
}

export interface FieldValidationError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  status: number;
  error: string;
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
    (value as { success?: unknown }).success !== true &&
    typeof (value as Partial<ApiErrorResponse>).status === 'number' &&
    typeof (value as Partial<ApiErrorResponse>).message === 'string'
  );
}
