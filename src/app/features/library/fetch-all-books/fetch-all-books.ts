import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Signal,
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
import {
  LibraryBookPageResponseDto,
  LibraryBookResponseDto,
  LibraryBookSortBy,
  LibrarySortDirection,
  PagedQueryLibraryBookRequestDto,
  isAvailableToBorrow,
} from '../library.model';
import { LibraryService, bookByline } from '../library.service';

interface SortOption {
  label: string;
  sortBy: LibraryBookSortBy;
  sortDirection: LibrarySortDirection;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Title A–Z', sortBy: 'title', sortDirection: 'ASC' },
  { label: 'Title Z–A', sortBy: 'title', sortDirection: 'DESC' },
  { label: 'Author A–Z', sortBy: 'author', sortDirection: 'ASC' },
  { label: 'Newest editions', sortBy: 'publicationYear', sortDirection: 'DESC' },
  { label: 'Oldest editions', sortBy: 'publicationYear', sortDirection: 'ASC' },
  { label: 'Most copies available', sortBy: 'availableCopies', sortDirection: 'DESC' },
  { label: 'Category', sortBy: 'category', sortDirection: 'ASC' },
  { label: 'Recently added', sortBy: 'createdAt', sortDirection: 'DESC' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;

export type BookRow = LibraryBookResponseDto & {
  byline: string;
  available: boolean;
  availability: string;
  availabilityClasses: string;
};

@Component({
  selector: 'app-fetch-all-books',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-books.html',
})
export class FetchAllBooks {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManage = input(false);
  readonly canBorrow = input(false);
  readonly add = output<void>();
  readonly view = output<LibraryBookResponseDto>();
  readonly edit = output<LibraryBookResponseDto>();
  readonly remove = output<LibraryBookResponseDto>();
  readonly borrow = output<LibraryBookResponseDto>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;

  protected readonly keywordText = signal('');
  protected readonly categoryText = signal('');
  protected readonly languageText = signal('');
  private readonly keyword = debounced(this.keywordText);
  private readonly category = debounced(this.categoryText);
  private readonly language = debounced(this.languageText);
  protected readonly availableOnly = signal(false);
  protected readonly activeFilter = signal<'true' | 'false'>('true');
  protected readonly yearFrom = signal('');
  protected readonly yearTo = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<LibraryBookPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;
  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);

  private readonly years = computed(() => {
    const parse = (text: string) => (/^\d{4}$/.test(text.trim()) ? Number(text.trim()) : undefined);
    return { from: parse(this.yearFrom()), to: parse(this.yearTo()) };
  });
  protected readonly yearRangeInvalid = computed(() => {
    const { from, to } = this.years();
    return from !== undefined && to !== undefined && from > to;
  });

  protected readonly query = computed<PagedQueryLibraryBookRequestDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const yearsOk = !this.yearRangeInvalid();
    return {
      keyword: this.keyword() || undefined,
      category: this.category() || undefined,
      language: this.language() || undefined,
      availableOnly: this.availableOnly() || undefined,
      active: this.activeFilter() === 'false' ? false : undefined,
      publicationYearFrom: yearsOk ? this.years().from : undefined,
      publicationYearTo: yearsOk ? this.years().to : undefined,
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
        this.keywordText(),
        this.categoryText(),
        this.languageText(),
        this.yearFrom(),
        this.yearTo(),
      ].some(Boolean),
  );

  protected readonly rows = computed<BookRow[]>(() =>
    (this.result()?.content ?? []).map((book) => {
      const available = isAvailableToBorrow(book);
      const [availability, availabilityClasses] = !book.active
        ? ['Withdrawn', 'bg-slate-400/10 text-slate-300 ring-slate-400/30']
        : !book.borrowable
          ? ['Reference only', 'bg-violet-400/10 text-violet-300 ring-violet-400/30']
          : available
            ? ['Available', 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30']
            : ['All copies out', 'bg-amber-400/10 text-amber-300 ring-amber-400/30'];
      return { ...book, byline: bookByline(book), available, availability, availabilityClasses };
    }),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No books';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });
  protected readonly stats = computed(() => {
    const rows = this.rows();
    const copies = rows.reduce((sum, b) => sum + b.totalCopies, 0);
    const available = rows.reduce((sum, b) => sum + b.availableCopies, 0);
    return { copies, available, onLoan: copies - available };
  });

  protected readonly brokenCovers = signal<ReadonlySet<string>>(new Set());

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

  protected coverFailed(id: string): void {
    this.brokenCovers.update((set) => new Set(set).add(id));
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
      this.keywordText,
      this.categoryText,
      this.languageText,
      this.yearFrom,
      this.yearTo,
    ]) {
      text.set('');
    }
    this.availableOnly.set(false);
    this.activeFilter.set('true');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  private load(query: PagedQueryLibraryBookRequestDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.library.searchBooks(query)
      : this.library.listBooks(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load the catalog. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  protected download(): void {
    if (this.downloading()) return;
    this.downloadError.set(null);
    this.downloading.set(true);
    this.library
      .downloadBooksPdf(this.query())
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error)
              ? error.message
              : 'Could not download the catalog. Try again.',
          ),
      });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.library
      .countBooks()
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
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
}
