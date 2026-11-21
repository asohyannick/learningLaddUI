// The backend returns two paging shapes. Check Swagger for which one an endpoint uses.

interface PageBase<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/**
 * `PagedResponseDto<T>`: used by courses, reviews and time tables.
 * Note: course lists use `page`/`size` names despite the DTO name, so check Swagger.
 */
export interface PagedResponse<T> extends PageBase<T> {
  pageNumber: number;
  pageSize: number;
  numberOfElements: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** `*PageResponseDto`: used by bookings, coupons, payments, library, partners, cart, AI assist... */
export interface PageResponse<T> extends PageBase<T> {
  page: number;
  size: number;
}

/** Query params accepted by paged list endpoints. */
export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string;
}
