import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import {
  LOAN_STATUSES,
  LibraryLoanPageResponseDto,
  LibraryLoanResponseDto,
  LibraryLoanSortBy,
  LibrarySortDirection,
  LoanStatus,
  PagedQueryLibraryLoanRequestDto,
  daysOverdue,
} from '../library.model';
import {
  LOAN_ACTION_LABELS,
  LibraryService,
  LoanAction,
  LoanMode,
  loanActions,
  loanStatusClasses,
  loanWhen,
  money,
} from '../library.service';

interface SortOption {
  label: string;
  sortBy: LibraryLoanSortBy;
  sortDirection: LibrarySortDirection;
}

/** The first option is the order of `GET /library/loans`. */
const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'DESC' },
  { label: 'Due soonest', sortBy: 'dueAt', sortDirection: 'ASC' },
  { label: 'Due latest', sortBy: 'dueAt', sortDirection: 'DESC' },
  { label: 'Recently borrowed', sortBy: 'borrowedAt', sortDirection: 'DESC' },
  { label: 'Recently reserved', sortBy: 'reservedAt', sortDirection: 'DESC' },
  { label: 'Return requests first', sortBy: 'returnRequestedAt', sortDirection: 'DESC' },
  { label: 'Recently returned', sortBy: 'returnedAt', sortDirection: 'DESC' },
  { label: 'Highest late fee', sortBy: 'lateFee', sortDirection: 'DESC' },
  { label: 'Status', sortBy: 'status', sortDirection: 'ASC' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'ASC' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;

export type LoanRow = LibraryLoanResponseDto & {
  when: string;
  overdueDays: number;
  fee: string;
  statusClasses: string;
  actions: { action: LoanAction; label: string }[];
};

export interface LoanActionRequest {
  action: LoanAction;
  loan: LibraryLoanResponseDto;
}

/**
 * Loans table. Staff see every loan (`GET /library/loans`, or `/loans/search` with filters);
 * students see only theirs (`/loans/search?studentId=…`). Each row offers the actions its status
 * allows; "Download PDF" exports the loans matching the filters.
 */
@Component({
  selector: 'app-fetch-all-loans',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-loans.html',
})
export class FetchAllLoans {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<LoanMode>('staff');
  /** Student profile ID: required in student mode, optional filter for staff. */
  readonly studentId = input<string | null>(null);
  readonly view = output<LibraryLoanResponseDto>();
  readonly act = output<LoanActionRequest>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = LOAN_STATUSES;

  protected readonly keywordText = signal('');
  private readonly keyword = toSignal(
    toObservable(this.keywordText).pipe(
      map((t) => t.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly status = signal<LoanStatus | ''>('');
  protected readonly overdueOnly = signal(false);
  protected readonly unpaidOnly = signal(false);
  protected readonly dueFrom = signal('');
  protected readonly dueTo = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<LibraryLoanPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;
  protected readonly outCount = signal<number | null>(null);
  private countRequest?: Subscription;
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly isStaff = computed(() => this.mode() === 'staff');
  protected readonly dueRangeInvalid = computed(
    () => !!this.dueFrom() && !!this.dueTo() && this.dueFrom() > this.dueTo(),
  );

  protected readonly query = computed<PagedQueryLibraryLoanRequestDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const datesOk = !this.dueRangeInvalid();
    return {
      studentId: this.studentId() || undefined,
      keyword: this.keyword() || undefined,
      status: this.status() || undefined,
      overdueOnly: this.overdueOnly() || undefined,
      unpaidFeesOnly: this.unpaidOnly() || undefined,
      dueFrom: datesOk && this.dueFrom() ? `${this.dueFrom()}T00:00:00Z` : undefined,
      dueTo: datesOk && this.dueTo() ? `${this.dueTo()}T23:59:59Z` : undefined,
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  protected readonly isFiltered = computed(() => {
    const {
      page: _p,
      size: _s,
      sortBy: _b,
      sortDirection: _d,
      studentId: _id,
      ...filters
    } = this.query();
    return Object.values(filters).some((value) => value !== undefined);
  });
  private readonly needsSearch = computed(
    () => this.isFiltered() || this.sortIndex() !== 0 || !!this.studentId() || !this.isStaff(),
  );
  protected readonly hasInput = computed(
    () => this.isFiltered() || !!this.keywordText() || !!this.dueFrom() || !!this.dueTo(),
  );

  protected readonly rows = computed<LoanRow[]>(() =>
    (this.result()?.content ?? []).map((loan) => ({
      ...loan,
      when: loanWhen(loan),
      overdueDays: daysOverdue(loan),
      fee: Number(loan.lateFee ?? 0) > 0 ? money(loan.lateFee, loan.feeCurrency) : '',
      statusClasses: loanStatusClasses(loan.status),
      actions: loanActions(loan, this.mode()).map((action) => ({
        action,
        label: LOAN_ACTION_LABELS[action],
      })),
    })),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No loans';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      reserved: rows.filter((l) => l.status === LoanStatus.RESERVED).length,
      out: rows.filter((l) => [LoanStatus.BORROWED, LoanStatus.OVERDUE].includes(l.status)).length,
      overdue: rows.filter((l) => l.status === LoanStatus.OVERDUE || l.overdueDays > 0).length,
      awaiting: rows.filter((l) => l.status === LoanStatus.RETURN_REQUESTED).length,
      unpaid: rows.filter((l) => Number(l.lateFee ?? 0) > 0 && !l.feePaid).length,
    };
  });

  constructor() {
    effect(() => {
      const query = this.query();
      const search = this.needsSearch();
      const allowed = this.isStaff() || !!this.studentId();
      untracked(() => (allowed ? this.load(query, search) : this.loading.set(false)));
    });
    effect(() => {
      if (this.isStaff()) untracked(() => this.loadCount());
    });
    this.destroyRef.onDestroy(() => {
      this.request?.unsubscribe();
      this.countRequest?.unsubscribe();
    });
  }

  reload(): void {
    this.load(this.query(), this.needsSearch());
    if (this.isStaff()) this.loadCount();
  }

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected setSort(index: string): void {
    this.setFilter(this.sortIndex, Number(index));
  }

  protected setSize(size: string): void {
    this.setFilter(this.size, Number(size));
  }

  protected clearFilters(): void {
    this.keywordText.set('');
    this.status.set('');
    this.overdueOnly.set(false);
    this.unpaidOnly.set(false);
    this.dueFrom.set('');
    this.dueTo.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected download(): void {
    if (this.downloading()) return;
    this.downloadError.set(null);
    this.downloading.set(true);
    this.library
      .downloadLoansPdf(this.query())
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not download the PDF. Try again.',
          ),
      });
  }

  private load(query: PagedQueryLibraryLoanRequestDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.library.searchLoans(query)
      : this.library.listLoans(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load the loans. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.library
      .countBorrowedBooks()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.outCount.set(count),
        error: () => this.outCount.set(null),
      });
  }
}
