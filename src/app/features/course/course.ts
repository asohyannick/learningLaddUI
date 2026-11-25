import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { COURSE_LEVELS, CourseLevel } from '../../core/enum/global-enum-configuration';
import { isApiErrorResponse } from '../../core/interface';
import { injectHeaderAccount } from '../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../shared/custom-pipe/enum-label-pipe';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { CourseCard } from './course-card/course-card';
import { CourseSearchQuery, CourseSortField } from './course.model';
import { CourseService } from './course.service';
import { FetchCourse } from './fetch-course/fetch-course';

interface SortOption {
  label: string;
  sortBy: CourseSortField;
  sortDirection: 'asc' | 'desc';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest', sortBy: 'publishedAt', sortDirection: 'desc' },
  { label: 'Name A–Z', sortBy: 'name', sortDirection: 'asc' },
  { label: 'Price: low to high', sortBy: 'price', sortDirection: 'asc' },
  { label: 'Price: high to low', sortBy: 'price', sortDirection: 'desc' },
  { label: 'Shortest first', sortBy: 'durationMinutes', sortDirection: 'asc' },
];

type PriceFilter = '' | 'FREE' | 'PAID';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-course',
  imports: [CourseCard, EnumLabelPipe, FetchCourse, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course.html',
})
export class Course {
  private readonly courses = inject(CourseService);
  private readonly router = inject(Router);
  protected readonly account = injectHeaderAccount();

  readonly course = input<string>();

  protected readonly levels = COURSE_LEVELS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletonSlots = Array.from({ length: 6 }, (_, i) => i);

  protected readonly searchText = signal('');
  private readonly search = toSignal(
    toObservable(this.searchText).pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly level = signal<CourseLevel | ''>('');
  protected readonly price = signal<PriceFilter>('');
  protected readonly sortIndex = signal(0);
  protected readonly page = signal(0);

  private readonly query = computed<CourseSearchQuery>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    return {
      published: true,
      search: this.search().trim() || undefined,
      level: this.level() || undefined,
      status: this.price() || undefined,
      page: this.page(),
      size: PAGE_SIZE,
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  protected readonly results = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.courses.searchCourses(params),
  });

  protected readonly list = computed(() =>
    this.results.hasValue() ? this.results.value().content : [],
  );
  protected readonly total = computed(() =>
    this.results.hasValue() ? this.results.value().totalElements : 0,
  );
  protected readonly totalPages = computed(() =>
    this.results.hasValue() ? Math.max(this.results.value().totalPages, 1) : 1,
  );
  protected readonly isFiltered = computed(() => {
    const q = this.query();
    return !!(q.search || q.level || q.status);
  });
  protected readonly summary = computed(() => {
    const total = this.total();
    if (!total) return '';
    const start = this.page() * PAGE_SIZE + 1;
    const end = start + this.list().length - 1;
    const noun = total === 1 ? 'course' : 'courses';
    return total <= PAGE_SIZE ? `${total} ${noun}` : `${start}–${end} of ${total} ${noun}`;
  });
  protected readonly errorMessage = computed(() => {
    const error = this.results.error();
    return isApiErrorResponse(error) ? error.message : 'Please try again in a moment.';
  });

  protected readonly pageNumbers = computed(() => {
    const count = this.totalPages();
    const current = this.page();
    const start = Math.max(0, Math.min(current - 2, count - 5));
    return Array.from({ length: Math.min(5, count) }, (_, i) => start + i);
  });

  protected setSearch(value: string): void {
    this.searchText.set(value);
    this.page.set(0);
  }

  protected setLevel(value: string): void {
    this.level.set(value as CourseLevel | '');
    this.page.set(0);
  }

  protected setPrice(value: PriceFilter): void {
    this.price.set(value);
    this.page.set(0);
  }

  protected setSort(index: string): void {
    this.sortIndex.set(Number(index));
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.level.set('');
    this.price.set('');
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
    if (typeof window !== 'undefined') {
      document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  protected closeCourse(): void {
    void this.router.navigate([], {
      queryParams: { course: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
