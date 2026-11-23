import { DatePipe } from '@angular/common';
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
  ENROLLMENT_STATUSES,
  EnrollmentStatus,
} from '../../../core/enum/global-enum-configuration';
import { PageResponse, isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import {
  StudentProfileSearchQuery,
  StudentProfileSortField,
  StudentProfileSummary,
} from '../student-profile.model';
import { StudentProfileService, fullName, profileInitials } from '../student-profile.service';

interface SortOption {
  label: string;
  sortBy: StudentProfileSortField;
  sortDirection: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'desc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'asc' },
  { label: 'First name A–Z', sortBy: 'firstName', sortDirection: 'asc' },
  { label: 'Last name A–Z', sortBy: 'lastName', sortDirection: 'asc' },
  { label: 'Email A–Z', sortBy: 'email', sortDirection: 'asc' },
  { label: 'Student number', sortBy: 'studentNumber', sortDirection: 'asc' },
  { label: 'Year: low to high', sortBy: 'currentLevel', sortDirection: 'asc' },
  { label: 'Year: high to low', sortBy: 'currentLevel', sortDirection: 'desc' },
  { label: 'Recently admitted', sortBy: 'admissionDate', sortDirection: 'desc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'desc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const SEARCH_DEBOUNCE_MS = 300;

export type StudentRow = StudentProfileSummary & { name: string; initials: string };

/**
 * Student profile list for staff. Without a keyword, filter or custom sort it calls
 * `GET /student-profile`; otherwise `/search`. The first card is `/count`, and
 * "Download PDF" exports every profile matching the current filters (`/download`).
 */
@Component({
  selector: 'app-fetch-all-student-profiles',
  imports: [DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-student-profiles.html',
})
export class FetchAllStudentProfiles {
  private readonly profiles = inject(StudentProfileService);
  private readonly destroyRef = inject(DestroyRef);

  /** Shows Edit and Delete (admins). */
  readonly canManage = input(false);
  readonly view = output<StudentProfileSummary>();
  readonly edit = output<StudentProfileSummary>();
  readonly remove = output<StudentProfileSummary>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly levels = LEVELS;
  protected readonly statuses = ENROLLMENT_STATUSES;

  /** Typed text; requests wait until the user pauses. */
  protected readonly searchText = signal('');
  protected readonly facultyText = signal('');
  private readonly search = toSignal(
    toObservable(this.searchText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
  private readonly faculty = toSignal(
    toObservable(this.facultyText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly status = signal<EnrollmentStatus | ''>('');
  protected readonly level = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);

  private readonly result = signal<PageResponse<StudentProfileSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  /** Row ID being exported, or 'all' for the whole filtered list. */
  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly query = computed<StudentProfileSearchQuery>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const level = this.level();
    return {
      search: this.search().trim() || undefined,
      faculty: this.faculty().trim() || undefined,
      enrollmentStatus: this.status() || undefined,
      currentLevel: level ? Number(level) : undefined,
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  protected readonly isFiltered = computed(() => {
    const q = this.query();
    return !!(q.search || q.faculty || q.enrollmentStatus || q.currentLevel);
  });
  private readonly needsSearch = computed(() => this.isFiltered() || this.sortIndex() !== 0);

  protected readonly rows = computed<StudentRow[]>(() =>
    (this.result()?.content ?? []).map((p) => ({
      ...p,
      name: fullName(p),
      initials: profileInitials(p),
    })),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No profiles';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  /** Active and applicant counts are for the loaded page. */
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      active: rows.filter((p) => p.enrollmentStatus === 'ACTIVE').length,
      applicants: rows.filter((p) => p.enrollmentStatus === 'APPLICANT').length,
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

  /** Reloads the page and the total, e.g. after a profile was edited or deleted. */
  reload(): void {
    this.load(this.query(), this.needsSearch());
    this.loadCount();
  }

  protected setSearch(value: string): void {
    this.searchText.set(value);
    this.page.set(0);
  }

  protected setFaculty(value: string): void {
    this.facultyText.set(value);
    this.page.set(0);
  }

  protected setStatus(value: string): void {
    this.status.set(value as EnrollmentStatus | '');
    this.page.set(0);
  }

  protected setLevel(value: string): void {
    this.level.set(value);
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
    this.facultyText.set('');
    this.status.set('');
    this.level.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  /** Exports every profile matching the filters (not only this page). */
  protected downloadAll(): void {
    this.export('all', this.profiles.downloadProfilesPdf(this.query()), 'this list');
  }

  protected downloadOne(row: StudentRow): void {
    this.export(row.id, this.profiles.downloadProfilePdf(row), row.name);
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

  private load(query: StudentProfileSearchQuery, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.profiles.searchProfiles(query)
      : this.profiles.listProfiles(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load student profiles. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.profiles
      .countProfiles()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        // The card shows a dash; the table reports the error.
        error: () => this.totalCount.set(null),
      });
  }
}
