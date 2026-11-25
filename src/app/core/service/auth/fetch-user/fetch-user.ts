import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
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
import { IUserResponse, UUID, isApiErrorResponse } from '../../../interface';
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

@Component({
  selector: 'app-fetch-user',
  imports: [DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './fetch-user.html',
})
export class FetchUser {
  private readonly users = inject(UserAdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly userId = input.required<UUID>();
  readonly currentUserId = input<UUID>();
  readonly closed = output<void>();
  readonly block = output<IUserResponse>();
  readonly unblock = output<IUserResponse>();

  private readonly loaded = signal<IUserResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly user = computed(() => {
    this.users.localChanges();
    const user = this.loaded();
    return user ? this.users.withLocalChanges(user) : null;
  });
  protected readonly status = computed(() => {
    const user = this.user();
    return user ? accountStatus(user) : null;
  });

  protected readonly badge = STATUS_BADGE;
  protected readonly displayName = displayName;
  protected readonly initials = initials;
  protected readonly canBlock = canBlock;
  protected readonly canUnblock = canUnblock;
  protected readonly blockDisabledReason = blockDisabledReason;

  constructor() {
    effect(() => {
      const id = this.userId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  protected load(id: UUID = this.userId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loaded.set(null);
    this.request = this.users
      .getUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.loaded.set(user);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this user. Try again.',
          );
          this.loading.set(false);
        },
      });
  }
}
