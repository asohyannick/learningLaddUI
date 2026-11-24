import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ADMIN_ROLES } from '../../core/enum/global-enum-configuration';
import { AuthService } from '../../core/service/auth/auth.service';
import { injectHeaderAccount } from '../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../shared/custom-pipe/enum-label-pipe';
import { PageHero } from '../../shared/reusable-components/page-hero/page-hero';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { resourceErrorMessage } from '../../shared/utils/resource-error';
import { JobCard } from './job-card/job-card';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  EmploymentType,
  ExperienceLevel,
  JobListingSortBy,
  JobListingSortDirection,
  WORK_MODES,
  WorkMode,
} from './job-listing.model';
import { JobListingService } from './job-listing.service';

const PAGE_SIZE = 12;

const SORTS: readonly {
  label: string;
  sortBy: JobListingSortBy;
  sortDirection: JobListingSortDirection;
}[] = [
  { label: 'Newest', sortBy: 'publishedAt', sortDirection: 'desc' },
  { label: 'Closing soon', sortBy: 'applicationDeadline', sortDirection: 'asc' },
  { label: 'Title A–Z', sortBy: 'title', sortDirection: 'asc' },
];

/**
 * Public careers page: open roles (`GET /job-listing/search?openOnly=true`) with search,
 * filters and paging. The API needs a signed-in user, so guests are asked to sign in.
 */
@Component({
  selector: 'app-job-listing',
  imports: [EnumLabelPipe, JobCard, PageHero, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-listing.html',
})
export class JobListing {
  protected readonly account = injectHeaderAccount();
  private readonly auth = inject(AuthService);
  protected readonly isSignedIn = this.auth.isAuthenticated;
  /** Staff who manage listings get a hint that drafts are not shown here. */
  protected readonly canManage = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(ADMIN_ROLES);
  });
  private readonly jobs = inject(JobListingService);

  protected readonly employmentTypes = EMPLOYMENT_TYPES;
  protected readonly workModes = WORK_MODES;
  protected readonly levels = EXPERIENCE_LEVELS;
  protected readonly sorts = SORTS;

  protected readonly searchText = signal('');
  private readonly search = toSignal(
    toObservable(this.searchText).pipe(
      map((text) => text.trim()),
      debounceTime(300),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly employmentType = signal<EmploymentType | ''>('');
  protected readonly workMode = signal<WorkMode | ''>('');
  protected readonly level = signal<ExperienceLevel | ''>('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);

  protected readonly listings = rxResource({
    params: () =>
      this.isSignedIn()
        ? {
            search: this.search() || undefined,
            employmentType: this.employmentType() || undefined,
            workMode: this.workMode() || undefined,
            experienceLevel: this.level() || undefined,
            sortBy: SORTS[this.sortIndex()].sortBy,
            sortDirection: SORTS[this.sortIndex()].sortDirection,
            page: this.page(),
            size: PAGE_SIZE,
          }
        : undefined,
    stream: ({ params }) => this.jobs.searchOpenJobListings(params),
  });

  protected readonly cards = computed(() =>
    this.listings.hasValue() ? this.listings.value().content : [],
  );
  protected readonly total = computed(() =>
    this.listings.hasValue() ? this.listings.value().totalElements : 0,
  );
  protected readonly totalPages = computed(() =>
    Math.max(this.listings.hasValue() ? this.listings.value().totalPages : 0, 1),
  );
  protected readonly errorMessage = computed(() => resourceErrorMessage(this.listings.error()));
  protected readonly isFiltered = computed(
    () => !!(this.searchText().trim() || this.employmentType() || this.workMode() || this.level()),
  );
  protected readonly skeletons = [1, 2, 3, 4, 5, 6];

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.employmentType.set('');
    this.workMode.set('');
    this.level.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
}
