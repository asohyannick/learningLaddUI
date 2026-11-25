import {
  LibraryBookResponseDto,
  LibraryLoanResponseDto,
  LoanStatus,
} from '../../features/library/library.model';

export function fakeBook(overrides: Partial<LibraryBookResponseDto> = {}): LibraryBookResponseDto {
  return {
    id: 'book-1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    publisher: 'Prentice Hall',
    publicationYear: 2008,
    language: 'English',
    category: 'Software',
    shelfLocation: 'B2-14',
    totalCopies: 3,
    availableCopies: 2,
    borrowable: true,
    loanPeriodDays: 14,
    maxRenewals: 2,
    dailyLateFee: 0.5,
    currency: 'USD',
    active: true,
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-01T09:00:00Z',
    ...overrides,
  };
}

export function fakeLoan(overrides: Partial<LibraryLoanResponseDto> = {}): LibraryLoanResponseDto {
  return {
    id: 'loan-1',
    loanReference: 'LN-2026-0007',
    bookId: 'book-1',
    bookTitle: 'Clean Code',
    bookIsbn: '9780132350884',
    studentId: 'sp-1',
    status: LoanStatus.RESERVED,
    reservedAt: '2026-11-24T10:00:00Z',
    reservationExpiresAt: '2026-11-26T10:00:00Z',
    renewalCount: 0,
    feePaid: false,
    dueReminderSent: false,
    createdAt: '2026-11-24T10:00:00Z',
    updatedAt: '2026-11-24T10:00:00Z',
    ...overrides,
  };
}

export function libraryPage<T>(content: T[], totalElements = content.length) {
  return {
    success: true,
    status: 200,
    message: 'OK',
    data: {
      content,
      page: 0,
      size: 20,
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / 20)),
      first: true,
      last: totalElements <= 20,
    },
    path: '',
    timestamp: '',
  };
}
