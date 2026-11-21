// Paging shapes. `IPagedResponse` and `IPageQuery` (global-interface.ts) cover `PagedResponseDto`.

/** `*PageResponseDto`: used by bookings, coupons, payments, library, partners, cart, AI assist... */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
