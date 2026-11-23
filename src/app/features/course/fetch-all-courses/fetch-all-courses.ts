import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  COURSE_LEVELS,
  COURSE_STATUSES,
  CourseLevel,
  CourseStatus,
} from '../../../core/enum/global-enum-configuration';
import { CourseSummary, PageResponse, isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { CourseSearchQuery, CourseSortField } from '../course.model';
import { CourseService, finalPrice } from '../course.service';

interface SortOption {
  label: string;
  sortBy: CourseSortField;
  sortDirection: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'desc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'asc' },
  { label: 'Name A–Z', sortBy: 'name', sortDirection: 'asc' },
  { label: 'Price: low to high', sortBy: 'price', sortDirection: 'asc' },
  { label: 'Price: high to low', sortBy: 'price', sortDirection: 'desc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'desc' },
  { label: 'Recently published', sortBy: 'publishedAt', sortDirection: 'desc' },
  { label: 'Shortest first', sortBy: 'durationMinutes', sortDirection: 'asc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

type PublishedFilter = '' | 'true' | 'false';

/**
 * Course list for the tutor and admin dashboards. Without a keyword, filter or custom sort it
 * calls `GET /course`; otherwise `GET /course/search`. The first card is `GET /course/count`.
 */
@Component({
  selector: 'app-fetch-all-courses',
  imports: [CurrencyPipe, DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-courses.html',
})
export class FetchAllCourses {
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canWrite = input(false);
  readonly canDelete = input(false);
  readonly view = output<CourseSummary>();
  readonly edit = output<CourseSummary>();
  readonly remove = output<CourseSummary>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly levels = COURSE_LEVELS;
  protected readonly statuses = COURSE_STATUSES;

  /** What the user types; the request waits until they pause. */
  protected readonly searchText = signal('');
  private readonly search = toSignal(
    toObservable(this.searchText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly level = signal<CourseLevel | ''>('');
  protected readonly status = signal<CourseStatus | ''>('');
  protected readonly published = signal<PublishedFilter>('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);

  private readonly result = signal<PageResponse<CourseSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  protected readonly downloadingId = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly query = computed<CourseSearchQuery>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const published = this.published();
    return {
      search: this.search().trim() || undefined,
      level: this.level() || undefined,
      status: this.status() || undefined,
      published: published === '' ? undefined : published === 'true',
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  /** A keyword, filter or non-default sort needs the search endpoint. */
  protected readonly isFiltered = computed(() => {
    const q = this.query();
    return !!(q.search || q.level || q.status || q.published !== undefined);
  });
  private readonly needsSearch = computed(() => this.isFiltered() || this.sortIndex() !== 0);

  protected readonly rows = computed(() =>
    (this.result()?.content ?? []).map((course) => ({
      ...course,
      finalPrice: finalPrice(course),
    })),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No courses';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  /** Published and free counts are for the loaded page. */
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      published: rows.filter((c) => c.published).length,
      free: rows.filter((c) => c.finalPrice === 0).length,
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

  /** Reloads the page and the total, e.g. after a course was created, edited or deleted. */
  reload(): void {
    this.load(this.query(), this.needsSearch());
    this.loadCount();
  }

  protected setSearch(value: string): void {
    this.searchText.set(value);
    this.page.set(0);
  }

  protected setLevel(value: string): void {
    this.level.set(value as CourseLevel | '');
    this.page.set(0);
  }

  protected setStatus(value: string): void {
    this.status.set(value as CourseStatus | '');
    this.page.set(0);
  }

  protected setPublished(value: string): void {
    this.published.set(value as PublishedFilter);
    this.page.set(0);
  }

  protected setSort(index: string): void {
    this.sortIndex.set(Number(index));
    this.page.set(0);
  }

  protected setSize(size: string): void {
    this.size.set(Number(size));
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.level.set('');
    this.status.set('');
    this.published.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected download(course: CourseSummary): void {
    if (this.downloadingId()) return;
    this.downloadError.set(null);
    this.downloadingId.set(course.id);
    this.courses
      .downloadCoursePdf(course.id, course.slug || 'course')
      .pipe(
        finalize(() => this.downloadingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => this.downloadError.set(`Could not download the PDF for "${course.name}".`),
      });
  }

  private load(query: CourseSearchQuery, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source: Observable<PageResponse<CourseSummary>> = search
      ? this.courses.searchCourses(query)
      : this.courses.listCourses(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load courses. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.courses
      .countCourses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        // The card shows a dash; the table reports the error.
        error: () => this.totalCount.set(null),
      });
  }
}
