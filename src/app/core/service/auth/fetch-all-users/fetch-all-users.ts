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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  IPageQuery,
  IPagedResponse,
  IUserResponse,
  PageSortField,
  UUID,
  isApiErrorResponse,
} from '../../../interface';
import { EnumLabelPipe } from '../../../../shared/custom-pipe/enum-label-pipe';
import {
  STATUS_BADGE,
  UserAdminService,
  accountStatus,
  blockDisabledReason,
  canBlock,
  canUnblock,
  displayName,
  initials,
} from '../user-admin.service';

interface SortOption {
  label: string;
  sortBy: PageSortField;
  sortDirection: 'ASC' | 'DESC';
}

const SORT_OPTIONS: readonly SortOption[] = [
  { label: 'Newest first', sortBy: 'createdAt', sortDirection: 'DESC' },
  { label: 'Oldest first', sortBy: 'createdAt', sortDirection: 'ASC' },
  { label: 'First name A–Z', sortBy: 'firstName', sortDirection: 'ASC' },
  { label: 'Last name A–Z', sortBy: 'lastName', sortDirection: 'ASC' },
  { label: 'Email A–Z', sortBy: 'email', sortDirection: 'ASC' },
  { label: 'Role', sortBy: 'role', sortDirection: 'ASC' },
  { label: 'Recently updated', sortBy: 'updatedAt', sortDirection: 'DESC' },
];

const PAGE_SIZES = [10, 20, 50, 100] as const;

@Component({
  selector: 'app-fetch-all-users',
  imports: [DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fetch-all-users.html',
})
export class FetchAllUsers {
  private readonly users = inject(UserAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUserId = input<UUID>();
  readonly view = output<IUserResponse>();
  readonly block = output<IUserResponse>();
  readonly unblock = output<IUserResponse>();

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSizes = PAGE_SIZES;

  protected readonly page = signal(0);
  protected readonly size = signal<number>(20);
  protected readonly sortIndex = signal(0);
  protected readonly filter = signal('');

  private readonly result = signal<IPagedResponse<IUserResponse> | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  private readonly query = computed<IPageQuery>(() => {
    const sort = SORT_OPTIONS[this.sortIndex()];
    return {
      page: this.page(),
      size: this.size(),
      sortBy: sort.sortBy,
      sortDirection: sort.sortDirection,
    };
  });

  private readonly rows = computed(() => {
    this.users.localChanges();
    return (this.result()?.content ?? []).map((user) => this.users.withLocalChanges(user));
  });

  protected readonly visibleRows = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const rows = this.rows();
    if (!term) return rows;
    return rows.filter((user) => `${displayName(user)} ${user.email}`.toLowerCase().includes(term));
  });

  protected readonly total = computed(() => this.result()?.totalElements ?? 0);
  protected readonly totalPages = computed(() => Math.max(this.result()?.totalPages ?? 0, 1));
  protected readonly hasPrevious = computed(() => this.page() > 0);
  protected readonly hasNext = computed(() => this.page() + 1 < this.totalPages());
  protected readonly rangeLabel = computed(() => {
    const count = this.rows().length;
    if (!count) return 'No users';
    const start = this.page() * this.size() + 1;
    return `${start}–${start + count - 1} of ${this.total()}`;
  });

  protected readonly stats = computed(() => {
    const rows = this.rows();
    const count = (status: string) => rows.filter((u) => accountStatus(u) === status).length;
    return {
      shown: rows.length,
      active: count('Active'),
      blocked: count('Blocked'),
      unverified: count('Unverified'),
    };
  });

  protected readonly badge = STATUS_BADGE;
  protected readonly accountStatus = accountStatus;
  protected readonly displayName = displayName;
  protected readonly initials = initials;
  protected readonly canBlock = canBlock;
  protected readonly canUnblock = canUnblock;
  protected readonly blockDisabledReason = blockDisabledReason;

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => this.load(query));
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  reload(): void {
    this.load(this.query());
  }

  protected setSort(index: string): void {
    this.sortIndex.set(Number(index));
    this.page.set(0);
  }

  protected setSize(size: string): void {
    this.size.set(Number(size));
    this.page.set(0);
  }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.totalPages() - 1));
  }

  private load(query: IPageQuery): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.users
      .listUsers(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load users. Try again.',
          );
          this.loading.set(false);
        },
      });
  }
}
