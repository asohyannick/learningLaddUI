import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { JobListingService } from '../../job-listing/job-listing.service';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JobApplicationPageResponseDto,
  JobApplicationQueryDto,
  JobApplicationResponseDto,
  JobApplicationSortBy,
} from '../job-application.model';
import {
  JobApplicationService,
  applicantInitials,
  applicantName,
  applicationStatusClasses,
  shortDate,
} from '../job-application.service';

interface SortOption {
  label: string;
  sortBy: JobApplicationSortBy;
  sortDirection: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'submittedAt', sortDirection: 'desc' },
  { label: 'Oldest first', sortBy: 'submittedAt', sortDirection: 'asc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'desc' },
  { label: 'Last name A–Z', sortBy: 'lastName', sortDirection: 'asc' },
  { label: 'Last name Z–A', sortBy: 'lastName', sortDirection: 'desc' },
  { label: 'Most experience', sortBy: 'yearsOfExperience', sortDirection: 'desc' },
  { label: 'Least experience', sortBy: 'yearsOfExperience', sortDirection: 'asc' },
  { label: 'Status', sortBy: 'status', sortDirection: 'asc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;

export type JobApplicationRow = JobApplicationResponseDto & {
  name: string;
  initials: string;
  jobTitle: string;
  submitted: string;
  statusClasses: string;
};

@Component({
  selector: 'app-fetch-all-job-applications',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-job-applications.html',
})
export class FetchAllJobApplications {
  private readonly applications = inject(JobApplicationService);
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly view = output<JobApplicationResponseDto>();
  readonly remove = output<JobApplicationResponseDto>();
  readonly add = output<void>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = APPLICATION_STATUSES;

  protected readonly jobOptions = rxResource({
    stream: () =>
      this.jobs
        .searchJobListings({ page: 0, size: 100, sortBy: 'title', sortDirection: 'asc' })
        .pipe(
          map((page) =>
            page.content.map((j) => ({ id: j.id, title: j.title, code: j.referenceCode })),
          ),
        ),
  });
  private readonly jobTitles = computed(
    () =>
      new Map(
        (this.jobOptions.hasValue() ? this.jobOptions.value() : []).map((j) => [j.id, j.title]),
      ),
  );

  protected readonly keywordText = signal('');
  private readonly keyword = toSignal(
    toObservable(this.keywordText).pipe(
      map((text) => text.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly jobId = signal('');
  protected readonly status = signal<ApplicationStatus | ''>('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<JobApplicationPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly dateRangeInvalid = computed(
    () => !!this.fromDate() && !!this.toDate() && this.fromDate() > this.toDate(),
  );

  protected readonly query = computed<JobApplicationQueryDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const datesOk = !this.dateRangeInvalid();
    return {
      keyword: this.keyword() || undefined,
      jobListingId: this.jobId() || undefined,
      status: this.status() || undefined,
      submittedFrom: datesOk && this.fromDate() ? `${this.fromDate()}T00:00:00Z` : undefined,
      submittedTo: datesOk && this.toDate() ? `${this.toDate()}T23:59:59Z` : undefined,
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
    () => this.isFiltered() || !!this.keywordText() || !!this.fromDate() || !!this.toDate(),
  );

  protected readonly rows = computed<JobApplicationRow[]>(() => {
    const titles = this.jobTitles();
    return (this.result()?.content ?? []).map((a) => ({
      ...a,
      name: applicantName(a),
      initials: applicantInitials(a),
      jobTitle: titles.get(a.jobListingId) ?? 'Job listing',
      submitted: shortDate(a.submittedAt ?? a.createdAt),
      statusClasses: applicationStatusClasses(a.status),
    }));
  });
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No applications';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      awaiting: rows.filter((a) => a.status === ApplicationStatus.SUBMITTED).length,
      documents: rows.reduce((sum, a) => sum + (a.supportingDocuments?.length ?? 0), 0),
    };
  });

  protected readonly brokenPhotos = signal<ReadonlySet<string>>(new Set());

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

  protected photoFailed(id: string): void {
    this.brokenPhotos.update((set) => new Set(set).add(id));
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
    this.jobId.set('');
    this.status.set('');
    this.fromDate.set('');
    this.toDate.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected downloadAll(): void {
    this.export('all', this.applications.downloadApplicationsPdf(this.query()), 'this list');
  }

  protected downloadOne(row: JobApplicationRow): void {
    this.export(row.id, this.applications.downloadApplicationPdf(row), row.name);
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

  private load(query: JobApplicationQueryDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.applications.searchApplications(query)
      : this.applications.listApplications(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error)
            ? error.message
            : 'Could not load the job applications. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.applications
      .countApplications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        error: () => this.totalCount.set(null),
      });
  }
}
