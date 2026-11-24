import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Signal,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { partnerStatusClasses, tierClassesDark } from '../partner-badges';
import {
  PARTNER_STATUSES,
  PARTNER_TYPES,
  PagedQueryRequestDto,
  PartnerSortBy,
  PartnerStatus,
  PartnerType,
  PartnersPageResponseDto,
  PartnersResponseDto,
  SPONSORSHIP_TIERS,
  SortDirection,
  SponsorshipTier,
  daysUntilAgreementEnds,
} from '../partnership.model';
import { PartnershipService, partnerInitials, sponsorshipLabel } from '../partnership.service';

interface SortOption {
  label: string;
  sortBy: PartnerSortBy;
  sortDirection: SortDirection;
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Display order', sortBy: 'displayOrder', sortDirection: 'ASC' },
  { label: 'Name A–Z', sortBy: 'name', sortDirection: 'ASC' },
  { label: 'Name Z–A', sortBy: 'name', sortDirection: 'DESC' },
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'DESC' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'ASC' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'DESC' },
  { label: 'Agreement ends soonest', sortBy: 'agreementEndDate', sortDirection: 'ASC' },
  { label: 'Agreement ends latest', sortBy: 'agreementEndDate', sortDirection: 'DESC' },
  { label: 'Largest sponsorship', sortBy: 'sponsorshipAmount', sortDirection: 'DESC' },
  { label: 'Smallest sponsorship', sortBy: 'sponsorshipAmount', sortDirection: 'ASC' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

/** '' = any, otherwise the boolean sent to the API. */
type YesNo = '' | 'true' | 'false';

export type PartnerRow = PartnersResponseDto & {
  initials: string;
  amount: string | null;
  statusClasses: string;
  tierClasses: string;
  daysLeft: number | null;
  /** "Ends in 12 day(s)" within 30 days, "Ended 3 day(s) ago" after; null otherwise. */
  endsLabel: string | null;
  ended: boolean;
};

function endsLabel(days: number | null): string | null {
  if (days === null || days > 30) return null;
  if (days < 0) return `Ended ${-days} day(s) ago`;
  return days === 0 ? 'Ends today' : `Ends in ${days} day(s)`;
}

/**
 * Staff partner list. Without a keyword, filter or custom sort it calls `GET /partners`;
 * otherwise `/search`. The first card is `/count`, and "Download PDF" exports every partner
 * matching the current filters (`/download`).
 */
@Component({
  selector: 'app-fetch-all-partners',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-partners.html',
})
export class FetchAllPartners {
  private readonly partners = inject(PartnershipService);
  private readonly destroyRef = inject(DestroyRef);

  readonly add = output<void>();
  readonly view = output<PartnersResponseDto>();
  readonly edit = output<PartnersResponseDto>();
  readonly remove = output<PartnersResponseDto>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;
  protected readonly statuses = PARTNER_STATUSES;
  protected readonly types = PARTNER_TYPES;
  protected readonly tiers = SPONSORSHIP_TIERS;

  /** Typed text; requests wait until the user pauses. */
  protected readonly keywordText = signal('');
  protected readonly industryText = signal('');
  protected readonly countryText = signal('');
  private readonly keyword = debounced(this.keywordText);
  private readonly industry = debounced(this.industryText);
  private readonly country = debounced(this.countryText);
  protected readonly status = signal<PartnerStatus | ''>('');
  protected readonly partnerType = signal<PartnerType | ''>('');
  protected readonly tier = signal<SponsorshipTier | ''>('');
  protected readonly featured = signal<YesNo>('');
  protected readonly shown = signal<YesNo>('');
  protected readonly sponsorsOnly = signal(false);
  protected readonly endFrom = signal('');
  protected readonly endTo = signal('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly showMoreFilters = signal(false);

  private readonly result = signal<PartnersPageResponseDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly totalCount = signal<number | null>(null);
  private countRequest?: Subscription;

  /** Row ID being exported, or 'all' for the whole filtered list. */
  protected readonly downloading = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  /** The API rejects a range that ends before it starts. */
  protected readonly rangeInvalid = computed(
    () => !!this.endFrom() && !!this.endTo() && this.endFrom() > this.endTo(),
  );

  protected readonly query = computed<PagedQueryRequestDto>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    const yesNo = (value: YesNo) => (value === '' ? undefined : value === 'true');
    const rangeOk = !this.rangeInvalid();
    return {
      keyword: this.keyword().trim() || undefined,
      industry: this.industry().trim() || undefined,
      country: this.country().trim() || undefined,
      status: this.status() || undefined,
      partnerType: this.partnerType() || undefined,
      sponsorshipTier: this.tier() || undefined,
      featured: yesNo(this.featured()),
      showOnWebsite: yesNo(this.shown()),
      sponsorsOnly: this.sponsorsOnly() || undefined,
      agreementEndFrom: (rangeOk && this.endFrom()) || undefined,
      agreementEndTo: (rangeOk && this.endTo()) || undefined,
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
      !!(this.keywordText() || this.industryText() || this.countryText()) ||
      this.rangeInvalid(),
  );

  protected readonly rows = computed<PartnerRow[]>(() =>
    (this.result()?.content ?? []).map((p) => {
      const daysLeft = daysUntilAgreementEnds(p);
      return {
        ...p,
        initials: partnerInitials(p.name),
        amount: sponsorshipLabel(p),
        statusClasses: partnerStatusClasses(p.status),
        tierClasses: tierClassesDark(p.sponsorshipTier),
        daysLeft,
        endsLabel: endsLabel(daysLeft),
        ended: daysLeft !== null && daysLeft < 0,
      };
    }),
  );
  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No partners';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  /** Counts for the loaded page. */
  protected readonly stats = computed(() => {
    const rows = this.rows();
    return {
      shown: rows.length,
      active: rows.filter((p) => p.status === PartnerStatus.ACTIVE).length,
      ending: rows.filter((p) => p.daysLeft !== null && p.daysLeft >= 0 && p.daysLeft <= 30).length,
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

  /** Reloads the page and the total, e.g. after a partner was added, edited or deleted. */
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
    for (const text of [this.keywordText, this.industryText, this.countryText]) text.set('');
    this.status.set('');
    this.partnerType.set('');
    this.tier.set('');
    this.featured.set('');
    this.shown.set('');
    this.sponsorsOnly.set(false);
    this.endFrom.set('');
    this.endTo.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  /** Exports every partner matching the filters (not only this page). */
  protected downloadAll(): void {
    this.export('all', this.partners.downloadPartnersPdf(this.query()), 'this list');
  }

  protected downloadOne(row: PartnerRow): void {
    this.export(row.id, this.partners.downloadPartnerPdf(row), row.name);
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

  private load(query: PagedQueryRequestDto, search: boolean): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const source = search
      ? this.partners.searchPartners(query)
      : this.partners.listPartners(query.page, query.size);
    this.request = source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          isApiErrorResponse(error) ? error.message : 'Could not load partners. Try again.',
        );
        this.loading.set(false);
      },
    });
  }

  private loadCount(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.partners
      .countPartners()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => this.totalCount.set(count),
        // The card shows a dash; the table reports the error.
        error: () => this.totalCount.set(null),
      });
  }
}

/** The signal's value once the user stops typing for a moment. */
function debounced(source: Signal<string>): Signal<string> {
  return toSignal(
    toObservable(source).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
}
