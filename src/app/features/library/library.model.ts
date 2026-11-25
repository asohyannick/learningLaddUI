import type { ISODateTime, UUID } from '../job-listing/job-listing.model';

/** `Library*PageResponseDto`: content plus page, size, totals and first/last flags. */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

/**
 * reserve (RESERVED, held 48 h) -> issue (BORROWED) -> [OVERDUE] -> return request
 * (RETURN_REQUESTED) -> confirm (RETURNED). Also CANCELLED and LOST.
 */
export enum LoanStatus {
  RESERVED = 'RESERVED',
  BORROWED = 'BORROWED',
  OVERDUE = 'OVERDUE',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
}

// ─────────────────────────────────────────────────────────────
// Book requests
// ─────────────────────────────────────────────────────────────
// ISBN: 10 or 13 digits (ISBN-10 may end with X), with a valid check digit.
// Dashes and spaces are stripped by the backend, so "978-0-13-468599-1" is fine.

export interface CreateLibraryBookRequestDto {
  /** Required, max 255 */
  title: string;
  /** Max 255 */
  subtitle?: string;
  /** Required, max 255 */
  author: string;
  /** ISBN-10 or ISBN-13 */
  isbn?: string;
  /** Max 150 */
  publisher?: string;
  /** 1400–2100 */
  publicationYear?: number;
  /** Max 50 */
  edition?: string;
  /** Max 50 */
  language?: string;
  /** Max 100 */
  category?: string;
  /** Max 10,000 */
  description?: string;
  /** 1–20,000 */
  pageCount?: number;
  courseId?: UUID;
  /** Max 50 */
  shelfLocation?: string;
  /** 1–10,000. Defaults to 1. */
  totalCopies?: number;
  /** Defaults to true */
  borrowable?: boolean;
  /** 1–365 days. Defaults to 14. */
  loanPeriodDays?: number;
  /** 0–10. Defaults to 2. */
  maxRenewals?: number;
  /** >= 0, at most 8 integer digits and 2 decimals. Defaults to 0. */
  dailyLateFee?: number;
  /** 3-letter ISO code, uppercased by the backend. Defaults to "USD". */
  currency?: string;
}

/** Partial update: omitted fields are left unchanged. */
export interface UpdateLibraryBookRequestDto {
  /** 1–255 */
  title?: string;
  /** Max 255 */
  subtitle?: string;
  /** 1–255 */
  author?: string;
  /** ISBN-10 or ISBN-13 */
  isbn?: string;
  /** Max 150 */
  publisher?: string;
  /** 1400–2100 */
  publicationYear?: number;
  /** Max 50 */
  edition?: string;
  /** Max 50 */
  language?: string;
  /** Max 100 */
  category?: string;
  /** Max 10,000 */
  description?: string;
  /** 1–20,000 */
  pageCount?: number;
  courseId?: UUID;
  /** Max 50 */
  shelfLocation?: string;
  /** 0–10,000 (0 is allowed here, unlike on create) */
  totalCopies?: number;
  borrowable?: boolean;
  /** 1–365 days */
  loanPeriodDays?: number;
  /** 0–10 */
  maxRenewals?: number;
  /** >= 0, at most 8 integer digits and 2 decimals */
  dailyLateFee?: number;
  /** 3-letter ISO code, uppercased by the backend */
  currency?: string;
  active?: boolean;
}

export type LibraryBookSortBy =
  'title' | 'author' | 'publicationYear' | 'createdAt' | 'availableCopies' | 'category';

/** Case-insensitive on the backend, so 'asc' / 'desc' also work. */
export type LibrarySortDirection = 'ASC' | 'DESC';

/** Sent as query parameters. */
export interface PagedQueryLibraryBookRequestDto {
  /** Max 100 */
  keyword?: string;
  /** Max 100 */
  category?: string;
  /** Max 50 */
  language?: string;
  courseId?: UUID;
  /** Defaults to false */
  availableOnly?: boolean;
  /** Defaults to true, so inactive books are hidden unless you send false */
  active?: boolean;
  /** >= 1400. Must not be greater than publicationYearTo. */
  publicationYearFrom?: number;
  /** <= 2100 */
  publicationYearTo?: number;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** 1–100. Defaults to 20. */
  size?: number;
  /** Defaults to "title" */
  sortBy?: LibraryBookSortBy;
  /** Defaults to "ASC" */
  sortDirection?: LibrarySortDirection;
}

export const LIBRARY_BOOK_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'title',
  sortDirection: 'ASC',
} as const satisfies Required<
  Pick<PagedQueryLibraryBookRequestDto, 'page' | 'size' | 'sortBy' | 'sortDirection'>
>;

// ─────────────────────────────────────────────────────────────
// Loan requests
// ─────────────────────────────────────────────────────────────

export interface BorrowBookRequestDto {
  /** Required */
  bookId: UUID;
  /** Max 1,000 */
  notes?: string;
}

export interface IssueBookRequestDto {
  /** Max 255 */
  conditionOnBorrow?: string;
  /** Must be in the future */
  dueAt?: ISODateTime;
  /** Max 1,000 */
  notes?: string;
}

export interface ReturnBookToLibraryRequestDto {
  /** Max 1,000 */
  note?: string;
}

export interface ConfirmBookReturnRequestDto {
  /** Required, max 255 */
  conditionOnReturn: string;
  /** Now or in the past */
  returnedAt?: ISODateTime;
  /** Defaults to false. Cannot be true together with lateFeeOverride. */
  waiveLateFee?: boolean;
  /** >= 0, at most 10 integer digits and 2 decimals */
  lateFeeOverride?: number;
  /** Defaults to false */
  feePaid?: boolean;
  /** Max 1,000 */
  notes?: string;
}

export interface ReportBookLostRequestDto {
  /** Required, max 1,000. What happened. */
  description: string;
  /** >= 0, at most 10 integer digits and 2 decimals */
  replacementFee?: number;
}

export type LibraryLoanSortBy =
  | 'createdAt'
  | 'reservedAt'
  | 'borrowedAt'
  | 'dueAt'
  | 'returnRequestedAt'
  | 'returnedAt'
  | 'status'
  | 'lateFee';

/** Sent as query parameters. */
export interface PagedQueryLibraryLoanRequestDto {
  bookId?: UUID;
  studentId?: UUID;
  status?: LoanStatus;
  /** Defaults to false */
  overdueOnly?: boolean;
  /** Defaults to false */
  unpaidFeesOnly?: boolean;
  /** Max 100 */
  keyword?: string;
  /** ISO timestamp. Must be on or before dueTo. */
  dueFrom?: ISODateTime;
  /** ISO timestamp */
  dueTo?: ISODateTime;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** 1–100. Defaults to 20. */
  size?: number;
  /** Defaults to "createdAt" */
  sortBy?: LibraryLoanSortBy;
  /** Defaults to "DESC" */
  sortDirection?: LibrarySortDirection;
}

export const LIBRARY_LOAN_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'createdAt',
  sortDirection: 'DESC',
} as const satisfies Required<
  Pick<PagedQueryLibraryLoanRequestDto, 'page' | 'size' | 'sortBy' | 'sortDirection'>
>;

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────
// @JsonInclude(NON_NULL): nullable fields are left out of the JSON when
// null, hence optional. Java primitives (int, boolean) are always present.

export interface LibraryBookResponseDto {
  id: UUID;

  title: string;
  subtitle?: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  edition?: string;
  language?: string;
  category?: string;
  description?: string;
  pageCount?: number;
  /** Cover image URL */
  coverImage?: string;
  courseId?: UUID;

  shelfLocation?: string;
  totalCopies: number;
  availableCopies: number;

  borrowable: boolean;
  loanPeriodDays: number;
  maxRenewals: number;
  dailyLateFee: number;
  currency: string;
  active: boolean;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LibraryLoanResponseDto {
  id: UUID;
  loanReference: string;

  bookId: UUID;
  bookTitle: string;
  bookIsbn?: string;
  studentId: UUID;
  status: LoanStatus;

  reservedAt?: ISODateTime;
  reservationExpiresAt?: ISODateTime;

  borrowedAt?: ISODateTime;
  dueAt?: ISODateTime;
  returnRequestedAt?: ISODateTime;
  returnRequestNote?: string;
  returnedAt?: ISODateTime;
  renewalCount: number;
  lastRenewedAt?: ISODateTime;

  issuedBy?: UUID;
  receivedBy?: UUID;
  conditionOnBorrow?: string;
  conditionOnReturn?: string;
  notes?: string;

  lateFee?: number;
  feeCurrency?: string;
  feePaid: boolean;
  feePaidAt?: ISODateTime;

  dueReminderSent: boolean;
  dueReminderSentAt?: ISODateTime;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type LibraryBookPageResponseDto = PageResponse<LibraryBookResponseDto>;
export type LibraryLoanPageResponseDto = PageResponse<LibraryLoanResponseDto>;

// ─────────────────────────────────────────────────────────────
// Client-side equivalents of availableToBorrow(), overdue() and
// daysOverdue(). They have no get/is prefix, so Jackson doesn't
// put them in the JSON.
// ─────────────────────────────────────────────────────────────

export const isAvailableToBorrow = (
  b: Pick<LibraryBookResponseDto, 'active' | 'borrowable' | 'availableCopies'>,
): boolean => b.active && b.borrowable && b.availableCopies > 0;

export const isLoanOverdue = (l: Pick<LibraryLoanResponseDto, 'status' | 'dueAt'>): boolean =>
  (l.status === LoanStatus.BORROWED || l.status === LoanStatus.OVERDUE) &&
  l.dueAt != null &&
  Date.now() > Date.parse(l.dueAt);

/** Whole days past due, rounded down like Duration.toDays(). 0 when not overdue. */
export const daysOverdue = (l: Pick<LibraryLoanResponseDto, 'status' | 'dueAt'>): number => {
  if (!isLoanOverdue(l)) return 0;
  return Math.max(Math.floor((Date.now() - Date.parse(l.dueAt!)) / 86_400_000), 0);
};
// ─────────────────────────────────────────────────────────────
// Added for the UI
// ─────────────────────────────────────────────────────────────

export const LOAN_STATUSES = Object.values(LoanStatus);

/** Copies that are out with a student (the backend's OUT_WITH_STUDENT). */
export const OUT_WITH_STUDENT: readonly LoanStatus[] = [
  LoanStatus.BORROWED,
  LoanStatus.OVERDUE,
  LoanStatus.RETURN_REQUESTED,
];

/** Finished loans: the only ones that can be deleted. */
export const FINAL_LOAN_STATUSES: readonly LoanStatus[] = [
  LoanStatus.RETURNED,
  LoanStatus.LOST,
  LoanStatus.CANCELLED,
];

/** Same rules as the backend DTOs. */
export const LIBRARY_LIMITS = {
  maxActiveLoansPerStudent: 5,
  reservationHoldHours: 48,
  maxCoverBytes: 5 * 1024 * 1024,
  coverTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
