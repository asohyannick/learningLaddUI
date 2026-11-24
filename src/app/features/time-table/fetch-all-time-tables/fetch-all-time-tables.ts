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
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { CourseService } from '../../course/course.service';
import {
  DAYS_OF_WEEK,
  DayOfWeek,
  SESSION_MODES,
  SessionMode,
  TIMETABLE_STATUSES,
  TimeTablePageResponseDto,
  TimeTablePagedQueryDto,
  TimeTableResponseDto,
  TimeTableSortBy,
  TimeTableSortDirection,
  TimeTableStatus,
} from '../time-table.model';
import {
  TimeTableService,
  durationLabel,
  scheduleLabel,
  sessionModeClasses,
  timeRange,
  timeTableStatusClasses,
} from '../time-table.service';

interface SortOption {
  label: string;
  sortBy: TimeTableSortBy;
  sortDirection: TimeTableSortDirection;
}

/** The first option is the order of `GET /time-table`, so it needs no search. */
const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'desc' },
  { label: 'Date, soonest first', sortBy: 'startDate', sortDirection: 'asc' },
  { label: 'Date, latest first', sortBy: 'startDate', sortDirection: 'desc' },
  { label: 'Start time, earliest', sortBy: 'startTime', sortDirection: 'asc' },
  { label: 'Start time, latest', sortBy: 'startTime', sortDirection: 'desc' },
  { label: 'End time, earliest', sortBy: 'endTime', sortDirection: 'asc' },
  { label: 'Title A–Z', sortBy: 'title', sortDirection: 'asc' },
  { label: 'Title Z–A', sortBy: 'title', sortDirection: 'desc' },
  { label: 'Status', sortBy: 'status', sortDirection: 'asc' },
  { label: 'Session mode', sortBy: 'sessionMode', sortDirection: 'asc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'asc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

/** '' = any, otherwise the boolean sent to the API. */
type YesNo = '' | 'true' | 'false';

export type TimeTableRow = TimeTableResponseDto & {
  schedule: string;
  times: string;
  duration: string;
  statusClasses: string;
  modeClasses: string;
};

/**
 * Timetable list. Without a keyword, filter or custom sort it calls `GET /time-table`;
 * otherwise `/search`. The first card is `/count`, and "Download PDF" exports every entry
 * matching the current filters (`/download`).
 */
@Component({
  selector: 'app-fetch-all-time-tables',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-time-tables.html',
})
export class FetchAllTimeTables {
  private readonly timeTables = inject(TimeTableService);
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);

  /** Shows the Delete buttons (the API lets only some staff roles delete). */
  readonly canDelete = input(false);
  readonly add = output<void>();
  readonly view = output<TimeTableResponseDto>();
  readonly edit = output<TimeTableResponseDto>();
  readonly remove = output<TimeTableResponseDto>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = TIMETABLE_STATUSES;
  protected readonly modes = SESSION_MODES;
  protected readonly days = DAYS_OF_WEEK;

  /** Courses for the course filter (the first 100, by name). */
  protected readonly courseOptions = rxResource({
    stream: () =>
      this.courses
        .searchCourses({ page: 0, size: 100, sortBy: 'name', sortDirection: 'asc' })
        .pipe(map((page) => page.content.map((c) => ({ id: c.id, name: c.name })))),
  });

  /** Typed text; requests wait until the user pauses. */
  protected readonly keywordText = signal('');
  private readonly keyword = toSignal(
    toObservable(this.keywordText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly courseId = signal('');
  protected readonly status = signal<TimeTableStatus | ''>('');
  protected readonly mode = signal<SessionMode | ''>('');
  protected readonly day = signal<DayOfWeek | ''>('');
  protected readonly recurring = signal<YesNo>('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly timeFrom = signal('');
  protected readonly timeTo = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<TimeTablePageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  /** Row ID being exported, or 'all' for the whole filtered list. */
  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  /** The API rejects ranges that end before they start; they are left out until fixed. */
  protected readonly dateRangeInvalid = computed(
    () => !!this.fromDate() && !!this.toDate() && this.fromDate() > this.toDate(),
  );
  protected readonly timeRangeInvalid = computed(
    () => !!this.timeFrom() && !!this.timeTo() && this.timeFrom() > this.timeTo(),
  );

  protected readonly query = computed<TimeTablePagedQueryDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const recurring = this.recurring();
    const datesOk = !this.dateRangeInvalid();
    const timesOk = !this.timeRangeInvalid();
    return {
      keyword: this.keyword().trim() || undefined,
      courseId: this.courseId() || undefined,
      status: this.status() || undefined,
      sessionMode: this.mode() || undefined,
      dayOfWeek: this.day() || undefined,
      recurring: recurring === '' ? undefined : recurring === 'true',
      fromDate: (datesOk && this.fromDate()) || undefined,
      toDate: (datesOk && this.toDate()) || undefined,
      startTimeFrom: (timesOk && this.timeFrom()) || undefined,
      startTimeTo: (timesOk && this.timeTo()) || undefined,
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  protected readonly isFiltered = computed(() => {
    const { page: _p, size: _s, sortBy: _b, sortDirection: _d, ...filters } = this.query();
    return Object.values(filters).some((value) => value !== undefined);
  });
  private readonly needsSearch = computed(() => this.isFiltered() || this.sortIndex() !== 0);
  /** Something typed or picked, even if the debounced query has not caught up yet. */
  protected readonly hasInput = computed(
    () =>
      this.isFiltered() ||
      !!this.keywordText() ||
      this.dateRangeInvalid() ||
      this.timeRangeInvalid(),
  );

  protected readonly rows = computed<TimeTableRow[]>(() =>
    (this.result()?.content ?? []).map((t) => ({
      ...t,
      schedule: scheduleLabel(t),
      times: timeRange(t),
      duration: durationLabel(t.durationMinutes),
      statusClasses: timeTableStatusClasses(t.status),
      modeClasses: sessionModeClasses(t.sessionMode),
    })),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No entries';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  /** Counts for the loaded page. */
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      recurring: rows.filter((t) => t.recurring).length,
      disrupted: rows.filter(
        (t) => t.status === TimeTableStatus.CANCELLED || t.status === TimeTableStatus.POSTPONED,
      ).length,
    };
  });

  constructor() {
    effect(() => {
      const query = this.query();
      const search = this.needsSearch();
      untracked(() => this.load(query, search));
    });
    this.loadCount();
    this.destroyRef.onDestroy(() => {
      this.request?.unsubscribe();
      this.countRequest?.unsubscribe();
    });
  }

  /** Reloads the page and the total, e.g. after an entry was added, edited or deleted. */
  reload(): void {
    this.load(this.query(), this.needsSearch());
    this.loadCount();
  }

  /** Sets a filter and goes back to the first page. */
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
    for (const text of [
      this.keywordText,
      this.courseId,
      this.fromDate,
      this.toDate,
      this.timeFrom,
      this.timeTo,
    ]) {
      text.set('');
    }
    this.status.set('');
    this.mode.set('');
    this.day.set('');
    this.recurring.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  /** Exports every entry matching the filters (not only this page). */
  protected downloadAll(): void {
    this.export('all', this.timeTables.downloadTimeTablesPdf(this.query()), 'this list');
  }

  protected downloadOne(row: TimeTableRow): void {
    this.export(row.id, this.timeTables.downloadTimeTablePdf(row), row.title);
  }

  private export(key: string, request: Observable<string>, what: string): void {
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
            isApiErrorResponse(error)
              ? error.message
              : `Could not download the PDF for ${what}. Try again.`,
          ),
      });
  }

  private load(query: TimeTablePagedQueryDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.timeTables.searchTimeTables(query)
      : this.timeTables.listTimeTables(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load the timetable. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.timeTables
      .countTimeTables()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        // The card shows a dash; the table reports the error.
        error: () => this.totalCount.set(null),
      });
  }
}
