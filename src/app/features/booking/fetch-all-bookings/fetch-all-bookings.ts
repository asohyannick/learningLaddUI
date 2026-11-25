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
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { TutorProfileService, tutorName } from '../../tutor-profile/tutor-profile.service';
import {
  BOOKING_SESSION_MODES,
  BOOKING_STATUSES,
  BookingPageResponseDto,
  BookingResponseDto,
  BookingSortBy,
  BookingStatus,
  PagedQueryBookingRequestDto,
  SessionMode,
} from '../booking.model';
import {
  BookingService,
  bookingDuration,
  bookingStatusClasses,
  bookingWhen,
  canApprove,
  canDecline,
  isActiveBooking,
} from '../booking.service';

export type BookingMode = 'staff' | 'student';
export type BookingAction = 'approve' | 'decline' | 'edit' | 'delete';

export interface BookingActionRequest {
  action: BookingAction;
  booking: BookingResponseDto;
}

interface SortOption {
  label: string;
  sortBy: BookingSortBy;
  sortDirection: 'ASC' | 'DESC';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Most recent sessions', sortBy: 'scheduledStart', sortDirection: 'DESC' },
  { label: 'Soonest sessions', sortBy: 'scheduledStart', sortDirection: 'ASC' },
  { label: 'Newest requests', sortBy: 'createdAt', sortDirection: 'DESC' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'DESC' },
  { label: 'Status', sortBy: 'status', sortDirection: 'ASC' },
  { label: 'Longest sessions', sortBy: 'durationMinutes', sortDirection: 'DESC' },
  { label: 'Oldest requests', sortBy: 'createdAt', sortDirection: 'ASC' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;

const LABELS: Record<BookingAction, string> = {
  approve: 'Approve',
  decline: 'Decline',
  edit: 'Edit',
  delete: 'Delete',
};

export function bookingActions(b: BookingResponseDto, mode: BookingMode): BookingAction[] {
  if (mode === 'staff') {
    return [
      ...(canApprove(b) ? (['approve'] as const) : []),
      ...(canDecline(b) ? (['decline'] as const) : []),
      'delete',
    ];
  }
  return [...(isActiveBooking(b) ? (['edit'] as const) : []), 'delete'];
}

export type BookingRow = BookingResponseDto & {
  when: string;
  duration: string;
  tutor: string;
  statusClasses: string;
  actions: { action: BookingAction; label: string }[];
};

@Component({
  selector: 'app-fetch-all-bookings',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-bookings.html',
})
export class FetchAllBookings {
  private readonly bookings = inject(BookingService);
  private readonly tutors = inject(TutorProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<BookingMode>('staff');
  readonly tutorView = input(false);
  readonly studentId = input<string | null>(null);
  readonly add = output<void>();
  readonly view = output<BookingResponseDto>();
  readonly act = output<BookingActionRequest>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = BOOKING_STATUSES;
  protected readonly modes = BOOKING_SESSION_MODES;

  protected readonly tutorOptions = rxResource({
    stream: () =>
      this.tutors
        .searchProfiles({ page: 0, size: 100, sortBy: 'lastName', sortDirection: 'asc' })
        .pipe(map((page) => page.content.map((t) => ({ id: t.id, name: tutorName(t) })))),
  });
  readonly tutorOptionsMap = computed<ReadonlyMap<string, string>>(
    () =>
      new Map(
        (this.tutorOptions.hasValue() ? this.tutorOptions.value() : []).map((t) => [t.id, t.name]),
      ),
  );

  protected readonly keywordText = signal('');
  private readonly keyword = toSignal(
    toObservable(this.keywordText).pipe(
      map((t) => t.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly status = signal<BookingStatus | ''>('');
  protected readonly sessionMode = signal<SessionMode | ''>('');
  protected readonly tutorId = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<BookingPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;
  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;
  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly isStaff = computed(() => this.mode() === 'staff');
  protected readonly dateRangeInvalid = computed(
    () => !!this.fromDate() && !!this.toDate() && this.fromDate() > this.toDate(),
  );

  protected readonly query = computed<PagedQueryBookingRequestDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const datesOk = !this.dateRangeInvalid();
    return {
      studentId: this.studentId() || undefined,
      tutorId: this.tutorId() || undefined,
      keyword: this.keyword() || undefined,
      status: this.status() || undefined,
      sessionMode: this.sessionMode() || undefined,
      startFrom:
        datesOk && this.fromDate()
          ? new Date(`${this.fromDate()}T00:00:00`).toISOString()
          : undefined,
      startTo:
        datesOk && this.toDate() ? new Date(`${this.toDate()}T23:59:59`).toISOString() : undefined,
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
    () => !this.isStaff() || this.isFiltered() || this.sortIndex() !== 0,
  );
  protected readonly hasInput = computed(
    () => this.isFiltered() || !!this.keywordText() || !!this.fromDate() || !!this.toDate(),
  );

  protected readonly rows = computed<BookingRow[]>(() => {
    const names = this.tutorOptionsMap();
    return (this.result()?.content ?? []).map((b) => ({
      ...b,
      when: bookingWhen(b),
      duration: bookingDuration(b.durationMinutes),
      tutor: (b.tutorId && names.get(b.tutorId)) || 'Tutor',
      statusClasses: bookingStatusClasses(b.status),
      actions: bookingActions(b, this.mode()).map((action) => ({ action, label: LABELS[action] })),
    }));
  });
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No bookings';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });
  protected readonly stats = computed(() => {
    const rows = this.rows();
    const count = (s: BookingStatus) => rows.filter((b) => b.status === s).length;
    return {
      pending: count(BookingStatus.PENDING),
      confirmed: count(BookingStatus.CONFIRMED),
      declined: count(BookingStatus.REJECTED),
      completed: count(BookingStatus.COMPLETED),
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
    this.sessionMode.set('');
    this.tutorId.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected downloadAll(): void {
    this.export('all', this.bookings.downloadBookingsPdf(this.query()));
  }

  protected downloadOne(row: BookingRow): void {
    this.export(row.id ?? 'row', this.bookings.downloadBookingPdf(row));
  }

  private export(key: string, request: ReturnType<BookingService['downloadBookingsPdf']>): void {
    if (this.downloading()) return;
    this.downloadError.set(null);
    this.downloading.set(key);
    request
      .pipe(
        finalize(() => this.downloading.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not download the PDF. Try again.',
          ),
      });
  }

  private load(query: PagedQueryBookingRequestDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.bookings.searchBookings(query)
      : this.bookings.listBookings(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load the bookings. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.bookings
      .countBookings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        error: () => this.totalCount.set(null),
      });
  }
}
