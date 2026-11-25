import {
  ChangeDetectionStrategy,
  Signal,
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
import { TUTOR_STATUSES, TutorStatus } from '../../../core/enum/global-enum-configuration';
import { PageResponse, isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import {
  TutorProfileSearchQuery,
  TutorProfileSortField,
  TutorProfileSummary,
} from '../tutor-profile.model';
import {
  TutorProfileService,
  hourlyRateLabel,
  tutorInitials,
  tutorName,
} from '../tutor-profile.service';
import { tutorStatusClasses } from '../tutor-status';

interface SortOption {
  label: string;
  sortBy: TutorProfileSortField;
  sortDirection: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'desc' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'asc' },
  { label: 'First name A–Z', sortBy: 'firstName', sortDirection: 'asc' },
  { label: 'Last name A–Z', sortBy: 'lastName', sortDirection: 'asc' },
  { label: 'Email A–Z', sortBy: 'email', sortDirection: 'asc' },
  { label: 'Tutor number', sortBy: 'tutorNumber', sortDirection: 'asc' },
  { label: 'Most experienced', sortBy: 'yearsOfExperience', sortDirection: 'desc' },
  { label: 'Least experienced', sortBy: 'yearsOfExperience', sortDirection: 'asc' },
  { label: 'Recently joined', sortBy: 'joinedDate', sortDirection: 'desc' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'desc' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const EXPERIENCE_OPTIONS = [1, 3, 5, 10, 15, 20] as const;
const SEARCH_DEBOUNCE_MS = 300;

export type TutorRow = TutorProfileSummary & {
  name: string;
  initials: string;
  rate: string | null;
  statusClasses: string;
};

@Component({
  selector: 'app-fetch-all-tutor-profiles',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-tutor-profiles.html',
})
export class FetchAllTutorProfiles {
  private readonly profiles = inject(TutorProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = input(false);
  readonly view = output<TutorProfileSummary>();
  readonly edit = output<TutorProfileSummary>();
  readonly remove = output<TutorProfileSummary>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly experienceOptions = EXPERIENCE_OPTIONS;
  protected readonly statuses = TUTOR_STATUSES;

  protected readonly searchText = signal('');
  protected readonly subjectText = signal('');
  protected readonly facultyText = signal('');
  private readonly search = debounced(this.searchText);
  private readonly subject = debounced(this.subjectText);
  private readonly faculty = debounced(this.facultyText);
  protected readonly status = signal<TutorStatus | ''>('');
  protected readonly minExperience = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);

  private readonly result = signal<PageResponse<TutorProfileSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly query = computed<TutorProfileSearchQuery>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const years = this.minExperience();
    return {
      search: this.search().trim() || undefined,
      subject: this.subject().trim() || undefined,
      faculty: this.faculty().trim() || undefined,
      status: this.status() || undefined,
      minYearsOfExperience: years ? Number(years) : undefined,
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  protected readonly isFiltered = computed(() => {
    const q = this.query();
    return !!(q.search || q.subject || q.faculty || q.status || q.minYearsOfExperience);
  });
  private readonly needsSearch = computed(() => this.isFiltered() || this.sortIndex() !== 0);
  protected readonly hasInput = computed(
    () => this.isFiltered() || !!(this.searchText() || this.subjectText() || this.facultyText()),
  );

  protected readonly rows = computed<TutorRow[]>(() =>
    (this.result()?.content ?? []).map((p) => ({
      ...p,
      name: tutorName(p),
      initials: tutorInitials(p),
      rate: hourlyRateLabel(p),
      statusClasses: tutorStatusClasses(p.status),
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

  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      active: rows.filter((p) => p.status === 'ACTIVE').length,
      pending: rows.filter((p) => p.status === 'PENDING_APPROVAL').length,
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

  reload(): void {
    this.load(this.query(), this.needsSearch());
    this.loadCount();
  }

  protected setSearch(value: string): void {
    this.searchText.set(value);
    this.page.set(0);
  }

  protected setSubject(value: string): void {
    this.subjectText.set(value);
    this.page.set(0);
  }

  protected setFaculty(value: string): void {
    this.facultyText.set(value);
    this.page.set(0);
  }

  protected setStatus(value: string): void {
    this.status.set(value as TutorStatus | '');
    this.page.set(0);
  }

  protected setMinExperience(value: string): void {
    this.minExperience.set(value);
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
    this.subjectText.set('');
    this.facultyText.set('');
    this.status.set('');
    this.minExperience.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  protected downloadAll(): void {
    this.export('all', this.profiles.downloadProfilesPdf(this.query()), 'this list');
  }

  protected downloadOne(row: TutorRow): void {
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

  private load(query: TutorProfileSearchQuery, search: boolean): void {
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
          isApiErrorResponse(error) ? error.message : 'Could not load tutor profiles. Try again.',
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
        error: () => this.totalCount.set(null),
      });
  }
}

function debounced(source: Signal<string>): Signal<string> {
  return toSignal(
    toObservable(source).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
}
