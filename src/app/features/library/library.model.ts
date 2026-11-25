import type { ISODateTime, UUID } from '../job-listing/job-listing.model';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export enum LoanStatus {
  RESERVED = 'RESERVED',
  BORROWED = 'BORROWED',
  OVERDUE = 'OVERDUE',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
}

export interface CreateLibraryBookRequestDto {
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
  courseId?: UUID;
  shelfLocation?: string;
  totalCopies?: number;
  borrowable?: boolean;
  loanPeriodDays?: number;
  maxRenewals?: number;
  dailyLateFee?: number;
  currency?: string;
}

export interface UpdateLibraryBookRequestDto {
  title?: string;
  subtitle?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  edition?: string;
  language?: string;
  category?: string;
  description?: string;
  pageCount?: number;
  courseId?: UUID;
  shelfLocation?: string;
  totalCopies?: number;
  borrowable?: boolean;
  loanPeriodDays?: number;
  maxRenewals?: number;
  dailyLateFee?: number;
  currency?: string;
  active?: boolean;
}

export type LibraryBookSortBy =
  'title' | 'author' | 'publicationYear' | 'createdAt' | 'availableCopies' | 'category';

export type LibrarySortDirection = 'ASC' | 'DESC';

export interface PagedQueryLibraryBookRequestDto {
  keyword?: string;
  category?: string;
  language?: string;
  courseId?: UUID;
  availableOnly?: boolean;
  active?: boolean;
  publicationYearFrom?: number;
  publicationYearTo?: number;
  page?: number;
  size?: number;
  sortBy?: LibraryBookSortBy;
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

export interface BorrowBookRequestDto {
  bookId: UUID;
  notes?: string;
}

export interface IssueBookRequestDto {
  conditionOnBorrow?: string;
  dueAt?: ISODateTime;
  notes?: string;
}

export interface ReturnBookToLibraryRequestDto {
  note?: string;
}

export interface ConfirmBookReturnRequestDto {
  conditionOnReturn: string;
  returnedAt?: ISODateTime;
  waiveLateFee?: boolean;
  lateFeeOverride?: number;
  feePaid?: boolean;
  notes?: string;
}

export interface ReportBookLostRequestDto {
  description: string;
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

export interface PagedQueryLibraryLoanRequestDto {
  bookId?: UUID;
  studentId?: UUID;
  status?: LoanStatus;
  overdueOnly?: boolean;
  unpaidFeesOnly?: boolean;
  keyword?: string;
  dueFrom?: ISODateTime;
  dueTo?: ISODateTime;
  page?: number;
  size?: number;
  sortBy?: LibraryLoanSortBy;
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

export const isAvailableToBorrow = (
  b: Pick<LibraryBookResponseDto, 'active' | 'borrowable' | 'availableCopies'>,
): boolean => b.active && b.borrowable && b.availableCopies > 0;

export const isLoanOverdue = (l: Pick<LibraryLoanResponseDto, 'status' | 'dueAt'>): boolean =>
  (l.status === LoanStatus.BORROWED || l.status === LoanStatus.OVERDUE) &&
  l.dueAt != null &&
  Date.now() > Date.parse(l.dueAt);

export const daysOverdue = (l: Pick<LibraryLoanResponseDto, 'status' | 'dueAt'>): number => {
  if (!isLoanOverdue(l)) return 0;
  return Math.max(Math.floor((Date.now() - Date.parse(l.dueAt!)) / 86_400_000), 0);
};

export const LOAN_STATUSES = Object.values(LoanStatus);

export const OUT_WITH_STUDENT: readonly LoanStatus[] = [
  LoanStatus.BORROWED,
  LoanStatus.OVERDUE,
  LoanStatus.RETURN_REQUESTED,
];

export const FINAL_LOAN_STATUSES: readonly LoanStatus[] = [
  LoanStatus.RETURNED,
  LoanStatus.LOST,
  LoanStatus.CANCELLED,
];

export const LIBRARY_LIMITS = {
  maxActiveLoansPerStudent: 5,
  reservationHoldHours: 48,
  maxCoverBytes: 5 * 1024 * 1024,
  coverTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
