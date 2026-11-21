import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { IUserResponse, UUID } from '../../../core/interface';
import { AuthService } from '../../../core/service/auth/auth.service';
import { BlockUserAccount } from '../../../core/service/auth/block-user-account/block-user-account';
import { DeleteUserAccount } from '../../../core/service/auth/delete-user-account/delete-user-account';
import { FetchAllUsers } from '../../../core/service/auth/fetch-all-users/fetch-all-users';
import { FetchUser } from '../../../core/service/auth/fetch-user/fetch-user';
import { UnBlockUserAccount } from '../../../core/service/auth/un-block-user-account/un-block-user-account';
import { displayName, initials } from '../../../core/service/auth/user-admin.service';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';

type Dialog =
  | { kind: 'block'; user: IUserResponse }
  | { kind: 'unblock'; user: IUserResponse }
  | { kind: 'delete' };

const TOAST_MS = 5_000;

/**
 * Admin console. For now: list users, view one, block / unblock them, delete your own account
 * and sign out. Everything else gets added to the sidebar as it is built.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [
    BlockUserAccount,
    DeleteUserAccount,
    EnumLabelPipe,
    FetchAllUsers,
    FetchUser,
    RouterLink,
    UnBlockUserAccount,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
  private readonly auth = inject(AuthService);

  protected readonly me = this.auth.user;
  protected readonly myName = computed(() => {
    const user = this.me();
    return user ? displayName(user) : 'Admin';
  });
  protected readonly myInitials = computed(() => {
    const user = this.me();
    return user ? initials(user) : 'A';
  });
  /** The API refuses to delete super admin accounts. */
  protected readonly canDeleteSelf = computed(() => this.me()?.role !== UserRole.SUPER_ADMIN);

  protected readonly sidebarOpen = signal(false);
  protected readonly selectedUserId = signal<UUID | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly toast = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.toastTimer));
  }

  protected openUser(user: IUserResponse): void {
    this.selectedUserId.set(user.id);
  }

  protected openDialog(dialog: Dialog): void {
    this.sidebarOpen.set(false);
    this.dialog.set(dialog);
  }

  protected onDialogDone(message: string): void {
    this.dialog.set(null);
    this.showToast(message);
  }

  private showToast(message: string): void {
    clearTimeout(this.toastTimer);
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_MS);
  }
}
