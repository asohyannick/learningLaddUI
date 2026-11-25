import { JobPhoto } from '../job-photo/job-photo';
import {
  ChangeDetectionStrategy,
  Signal,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  EmploymentType,
  ExperienceLevel,
  JOB_STATUSES,
  JobListingPageResponseDto,
  JobListingPagedQueryDto,
  JobListingSortBy,
  JobListingSortDirection,
  JobListingSummaryResponseDto,
  JobStatus,
  WORK_MODES,
  WorkMode,
} from '../job-listing.model';
import {
  JobListingService,
  deadlineLabel,
  jobDateLabel,
  jobLocation,
  jobStatusClasses,
} from '../job-listing.service';

interface SortOption {
  label: string;
  sortBy: JobListingSortBy;
  sortDirection: JobListingSortDirection;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'desc' },
  { label: 'Deadline, soonest first', sortBy: 'applicationDeadline', sortDirection: 'asc' },
  { label: 'Deadline, latest first', sortBy: 'applicationDeadline', sortDirection: 'desc' },
  { label: 'Recently published', sortBy: 'publishedAt', sortDirection: 'desc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'desc' },
  { label: 'Title A–Z', sortBy: 'title', sortDirection: 'asc' },
  { label: 'Title Z–A', sortBy: 'title', sortDirection: 'desc' },
  { label: 'Salary, highest first', sortBy: 'salaryMin', sortDirection: 'desc' },
  { label: 'Salary, lowest first', sortBy: 'salaryMin', sortDirection: 'asc' },
  { label: 'Most vacancies', sortBy: 'numberOfVacancies', sortDirection: 'desc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'asc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

export type JobListingRow = JobListingSummaryResponseDto & {
  location: string;
  deadline: string;
  statusClasses: string;
};

@Component({
  selector: 'app-fetch-all-job-listings',
  imports: [JobPhoto, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-job-listings.html',
})
export class FetchAllJobListings {
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly add = output<void>();
  readonly view = output<JobListingSummaryResponseDto>();
  readonly edit = output<JobListingSummaryResponseDto>();
  readonly remove = output<JobListingSummaryResponseDto>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = JOB_STATUSES;
  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly levels = EXPERIENCE_LEVELS;

  protected readonly searchText = signal('');
  protected readonly facultyText = signal('');
  protected readonly departmentText = signal('');
  protected readonly cityText = signal('');
  protected readonly countryText = signal('');
  protected readonly minSalaryText = signal('');
  protected readonly maxSalaryText = signal('');
  private readonly typed = computed(() => ({
    search: this.debounced.search(),
    faculty: this.debounced.faculty(),
    department: this.debounced.department(),
    city: this.debounced.city(),
    country: this.debounced.country(),
    minSalary: this.debounced.minSalary(),
    maxSalary: this.debounced.maxSalary(),
  }));
  private readonly debounced = {
    search: debounced(this.searchText),
    faculty: debounced(this.facultyText),
    department: debounced(this.departmentText),
    city: debounced(this.cityText),
    country: debounced(this.countryText),
    minSalary: debounced(this.minSalaryText),
    maxSalary: debounced(this.maxSalaryText),
  };

  protected readonly status = signal<JobStatus | ''>('');
  protected readonly employmentType = signal<EmploymentType | ''>('');
  protected readonly workMode = signal<WorkMode | ''>('');
  protected readonly level = signal<ExperienceLevel | ''>('');
  protected readonly openOnly = signal(false);
  protected readonly deadlineFrom = signal('');
  protected readonly deadlineTo = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<JobListingPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly deadlineRangeInvalid = computed(
    () => !!this.deadlineFrom() && !!this.deadlineTo() && this.deadlineFrom() > this.deadlineTo(),
  );
  private readonly salaries = computed(() => {
    const parse = (text: string) => (/^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : undefined);
    const typed = this.typed();
    return { min: parse(typed.minSalary ?? ''), max: parse(typed.maxSalary ?? '') };
  });
  protected readonly salaryRangeInvalid = computed(() => {
    const { min, max } = this.salaries();
    return min !== undefined && max !== undefined && min > max;
  });

  protected readonly query = computed<JobListingPagedQueryDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const typed = this.typed();
    const deadlinesOk = !this.deadlineRangeInvalid();
    const salariesOk = !this.salaryRangeInvalid();
    return {
      search: typed.search || undefined,
      faculty: typed.faculty || undefined,
      department: typed.department || undefined,
      city: typed.city || undefined,
      country: typed.country || undefined,
      status: this.status() || undefined,
      employmentType: this.employmentType() || undefined,
      workMode: this.workMode() || undefined,
      experienceLevel: this.level() || undefined,
      openOnly: this.openOnly() || undefined,
      minSalary: salariesOk ? this.salaries().min : undefined,
      maxSalary: salariesOk ? this.salaries().max : undefined,
      deadlineFrom: (deadlinesOk && this.deadlineFrom()) || undefined,
      deadlineTo: (deadlinesOk && this.deadlineTo()) || undefined,
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
  protected readonly hasInput = computed(
    () =>
      this.isFiltered() ||
      [
        this.searchText(),
        this.facultyText(),
        this.departmentText(),
        this.cityText(),
        this.countryText(),
        this.minSalaryText(),
        this.maxSalaryText(),
        this.deadlineFrom(),
        this.deadlineTo(),
      ].some(Boolean),
  );

  protected readonly rows = computed<JobListingRow[]>(() =>
    (this.result()?.content ?? []).map((job) => ({
      ...job,
      location: jobLocation(job),
      deadline: job.applicationDeadline ? jobDateLabel(job.applicationDeadline) : 'No deadline',
      statusClasses: jobStatusClasses(job.status),
    })),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No listings';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      open: rows.filter((job) => job.status === JobStatus.OPEN).length,
      drafts: rows.filter((job) => job.status === JobStatus.DRAFT).length,
      vacancies: rows.reduce((sum, job) => sum + (job.numberOfVacancies ?? 0), 0),
    };
  });

  protected deadlineNote(row: JobListingRow): string | null {
    const note = deadlineLabel(row);
    return note && !note.startsWith('Apply by') ? note : null;
  }

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

  reload(): void {
    this.load(this.query(), this.needsSearch());
    this.loadCount();
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
    for (const text of [
      this.searchText,
      this.facultyText,
      this.departmentText,
      this.cityText,
      this.countryText,
      this.minSalaryText,
      this.maxSalaryText,
      this.deadlineFrom,
      this.deadlineTo,
    ]) {
      text.set('');
    }
    this.status.set('');
    this.employmentType.set('');
    this.workMode.set('');
    this.level.set('');
    this.openOnly.set(false);
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected downloadAll(): void {
    this.export('all', this.jobs.downloadJobListingsPdf(this.query()), 'this list');
  }

  protected downloadOne(row: JobListingRow): void {
    this.export(row.id, this.jobs.downloadJobListingPdf(row), row.title);
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

  private load(query: JobListingPagedQueryDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.jobs.searchJobListings(query)
      : this.jobs.listJobListings(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load the job listings. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.jobs
      .countJobListings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        error: () => this.totalCount.set(null),
      });
  }
}

function debounced(text: Signal<string>): Signal<string> {
  return toSignal(
    toObservable(text).pipe(
      map((value) => value.trim()),
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
}
