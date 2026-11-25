import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  BorrowBookRequestDto,
  ConfirmBookReturnRequestDto,
  CreateLibraryBookRequestDto,
  FINAL_LOAN_STATUSES,
  IssueBookRequestDto,
  LibraryBookPageResponseDto,
  LibraryBookResponseDto,
  LibraryLoanPageResponseDto,
  LibraryLoanResponseDto,
  LoanStatus,
  OUT_WITH_STUDENT,
  PagedQueryLibraryBookRequestDto,
  PagedQueryLibraryLoanRequestDto,
  ReportBookLostRequestDto,
  ReturnBookToLibraryRequestDto,
  UpdateLibraryBookRequestDto,
} from './library.model';

/**
 * Library API (`/library`).
 * Books: everyone signed in reads; library staff add, update and delete.
 * Loans: students borrow (reserve), renew and return their own; staff issue, update, confirm
 * returns, search, count, export and delete; both can cancel reservations and report losses.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/library`;

  // ─── Books ─────────────────────────────────────────────────────────

  /** `GET /library/books`: sorted by title. */
  listBooks(page = 0, size = 20): Observable<LibraryBookPageResponseDto> {
    return this.http
      .get<ApiResponse<LibraryBookPageResponseDto>>(`${this.api}/books`, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /library/books/search`. */
  searchBooks(query: PagedQueryLibraryBookRequestDto): Observable<LibraryBookPageResponseDto> {
    return this.http
      .get<ApiResponse<LibraryBookPageResponseDto>>(`${this.api}/books/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /library/books/count`: titles in the catalog. */
  countBooks(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/books/count`)
      .pipe(map((res) => Number(res.data)));
  }

  /**
   * `GET /library/books/download` (super admin, admin, IT admin, librarian): PDF of the books
   * matching the filters (page and size are ignored, at most 2,000 rows). Emits the file name.
   */
  downloadBooksPdf(query: PagedQueryLibraryBookRequestDto = {}): Observable<string> {
    const { page: _page, size: _size, ...filters } = query;
    return this.http
      .get(`${this.api}/books/download`, {
        params: toParams(filters),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => {
          const fileName =
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ??
            'library-catalog.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /** `GET /library/books/{id}`. */
  getBook(id: string): Observable<LibraryBookResponseDto> {
    return this.http
      .get<ApiResponse<LibraryBookResponseDto>>(`${this.api}/books/${encodeURIComponent(id)}`)
      .pipe(map((res) => res.data));
  }

  /** `POST /library/books` (multipart: JSON `data` and an optional `coverImage`). */
  addBook(
    data: CreateLibraryBookRequestDto,
    coverImage?: File | null,
  ): Observable<ApiResponse<LibraryBookResponseDto>> {
    return this.http.post<ApiResponse<LibraryBookResponseDto>>(
      `${this.api}/books`,
      bookMultipart(data, coverImage),
    );
  }

  /** `PATCH /library/books/{id}` (multipart). Send only what changed. */
  updateBook(
    id: string,
    data: UpdateLibraryBookRequestDto,
    coverImage?: File | null,
  ): Observable<ApiResponse<LibraryBookResponseDto>> {
    return this.http.patch<ApiResponse<LibraryBookResponseDto>>(
      `${this.api}/books/${id}`,
      bookMultipart(data, coverImage),
    );
  }

  /** `DELETE /library/books/{id}`: refused when the book has loan history. */
  deleteBook(id: string): Observable<string> {
    return this.http
      .delete<ApiResponse<null>>(`${this.api}/books/${id}`)
      .pipe(map((res) => res.message));
  }

  // ─── Loans ─────────────────────────────────────────────────────────

  /** `POST /library/loans`: the signed-in student reserves a copy for 48 hours. */
  borrowBook(
    data: BorrowBookRequestDto,
    idempotencyKey: string,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.http.post<ApiResponse<LibraryLoanResponseDto>>(`${this.api}/loans`, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  /** `PATCH /library/loans/{id}/issue`: RESERVED → BORROWED. */
  issueBook(
    id: string,
    data: IssueBookRequestDto,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.patch(`${id}/issue`, data);
  }

  /** `GET /library/loans`: newest first (staff). */
  listLoans(page = 0, size = 20): Observable<LibraryLoanPageResponseDto> {
    return this.http
      .get<ApiResponse<LibraryLoanPageResponseDto>>(`${this.api}/loans`, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /library/loans/search`. */
  searchLoans(query: PagedQueryLibraryLoanRequestDto): Observable<LibraryLoanPageResponseDto> {
    return this.http
      .get<ApiResponse<LibraryLoanPageResponseDto>>(`${this.api}/loans/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /library/loans/count`: copies out with students. */
  countBorrowedBooks(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/loans/count`)
      .pipe(map((res) => Number(res.data)));
  }

  /** `GET /library/loans/download`: PDF of matching loans (no paging, at most 2,000 rows). */
  downloadLoansPdf(query: PagedQueryLibraryLoanRequestDto = {}): Observable<string> {
    const { page: _page, size: _size, ...filters } = query;
    return this.http
      .get(`${this.api}/loans/download`, {
        params: toParams(filters),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => {
          const fileName =
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'borrowed-books.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /** PDF of one loan: the export filters by its unique loan reference. */
  downloadLoanPdf(loan: Pick<LibraryLoanResponseDto, 'loanReference'>): Observable<string> {
    return this.downloadLoansPdf({ keyword: loan.loanReference });
  }

  /** `GET /library/loans/{id}`: staff see any loan, students their own. */
  getLoan(id: string): Observable<LibraryLoanResponseDto> {
    return this.http
      .get<ApiResponse<LibraryLoanResponseDto>>(`${this.api}/loans/${encodeURIComponent(id)}`)
      .pipe(map((res) => res.data));
  }

  /** `PATCH /library/loans/{id}`: new due date, condition or note on an active loan. */
  updateLoan(
    id: string,
    data: IssueBookRequestDto,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.patch(id, data);
  }

  /** `PATCH /library/loans/{id}/renew` (the borrowing student). */
  renewLoan(id: string): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.http.patch<ApiResponse<LibraryLoanResponseDto>>(
      `${this.api}/loans/${id}/renew`,
      null,
    );
  }

  /** `PATCH /library/loans/{id}/return` (the borrowing student): → RETURN_REQUESTED. */
  returnLoan(
    id: string,
    data: ReturnBookToLibraryRequestDto,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.patch(`${id}/return`, data);
  }

  /** `PATCH /library/loans/{id}/confirm-return` (staff): → RETURNED, fee finalized. */
  confirmReturn(
    id: string,
    data: ConfirmBookReturnRequestDto,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.patch(`${id}/confirm-return`, data);
  }

  /** `PATCH /library/loans/{id}/cancel`: RESERVED → CANCELLED. */
  cancelReservation(id: string): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.http.patch<ApiResponse<LibraryLoanResponseDto>>(
      `${this.api}/loans/${id}/cancel`,
      null,
    );
  }

  /** `PATCH /library/loans/{id}/report-lost`. */
  reportLost(
    id: string,
    data: ReportBookLostRequestDto,
  ): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.patch(`${id}/report-lost`, data);
  }

  /** `DELETE /library/loans/{id}`: finished loans only. */
  deleteLoan(id: string): Observable<string> {
    return this.http
      .delete<ApiResponse<null>>(`${this.api}/loans/${id}`)
      .pipe(map((res) => res.message));
  }

  private patch(path: string, body: object): Observable<ApiResponse<LibraryLoanResponseDto>> {
    return this.http.patch<ApiResponse<LibraryLoanResponseDto>>(`${this.api}/loans/${path}`, body);
  }
}

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text !== '') params = params.set(key, text);
  }
  return params;
}

function bookMultipart(data: object, coverImage?: File | null): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (coverImage) body.append('coverImage', coverImage);
  return body;
}

// ─── Display helpers ─────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "24 Nov 2026" from an ISO date or timestamp (UTC date part). */
export function libraryDate(value?: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : value;
}

/** "USD 1.50", or '' for none. */
export function money(amount?: number | null, currency?: string): string {
  if (amount === undefined || amount === null) return '';
  return `${currency ?? 'USD'} ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "J. R. R. Tolkien · 1954" */
export function bookByline(
  book: Pick<LibraryBookResponseDto, 'author' | 'publicationYear'>,
): string {
  return [book.author, book.publicationYear].filter(Boolean).join(' · ');
}

export function isOut(loan: Pick<LibraryLoanResponseDto, 'status'>): boolean {
  return OUT_WITH_STUDENT.includes(loan.status);
}

export function isFinished(loan: Pick<LibraryLoanResponseDto, 'status'>): boolean {
  return FINAL_LOAN_STATUSES.includes(loan.status);
}

/** Badge classes for a loan status on a dark background. */
export function loanStatusClasses(status: LoanStatus): string {
  switch (status) {
    case LoanStatus.RESERVED:
      return 'bg-sky-400/10 text-sky-300 ring-sky-400/30';
    case LoanStatus.BORROWED:
      return 'bg-indigo-400/10 text-indigo-300 ring-indigo-400/30';
    case LoanStatus.RETURN_REQUESTED:
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/30';
    case LoanStatus.RETURNED:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case LoanStatus.CANCELLED:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
    default:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
  }
}

export type LoanAction =
  'issue' | 'update' | 'confirm' | 'renew' | 'return' | 'cancel' | 'lost' | 'delete';

export type LoanMode = 'staff' | 'student';

export const LOAN_ACTION_LABELS: Record<LoanAction, string> = {
  issue: 'Issue',
  update: 'Update',
  confirm: 'Confirm return',
  renew: 'Renew',
  return: 'Return',
  cancel: 'Cancel reservation',
  lost: 'Report lost',
  delete: 'Delete',
};

/** What can be done with a loan, by its status and who is looking (mirrors the backend rules). */
export function loanActions(
  loan: Pick<LibraryLoanResponseDto, 'status'>,
  mode: LoanMode,
): LoanAction[] {
  const s = loan.status;
  if (mode === 'student') {
    if (s === LoanStatus.RESERVED) return ['cancel'];
    if (s === LoanStatus.BORROWED) return ['renew', 'return', 'lost'];
    if (s === LoanStatus.OVERDUE) return ['return', 'lost'];
    if (s === LoanStatus.RETURN_REQUESTED) return ['lost'];
    return [];
  }
  if (s === LoanStatus.RESERVED) return ['issue', 'cancel'];
  if (s === LoanStatus.BORROWED || s === LoanStatus.OVERDUE) return ['confirm', 'update', 'lost'];
  if (s === LoanStatus.RETURN_REQUESTED) return ['confirm', 'lost'];
  return ['delete'];
}

/** "Due 4 Dec 2026", "Pick up by …", "Returned …", for a table cell. */
export function loanWhen(loan: LibraryLoanResponseDto): string {
  switch (loan.status) {
    case LoanStatus.RESERVED:
      return `Pick up by ${libraryDate(loan.reservationExpiresAt)}`;
    case LoanStatus.BORROWED:
    case LoanStatus.OVERDUE:
      return `Due ${libraryDate(loan.dueAt)}`;
    case LoanStatus.RETURN_REQUESTED:
      return `Returned ${libraryDate(loan.returnRequestedAt)}, awaiting check`;
    case LoanStatus.RETURNED:
      return `Returned ${libraryDate(loan.returnedAt)}`;
    default:
      return libraryDate(loan.updatedAt);
  }
}

/** Today as "YYYY-MM-DD" in the user's time zone (for date inputs). */
export function todayLocal(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
