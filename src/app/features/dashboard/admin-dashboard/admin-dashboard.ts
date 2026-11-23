import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { IUserResponse, UUID } from '../../../core/interface';
import { AuthService } from '../../../core/service/auth/auth.service';
import { BlockUserAccount } from '../../../core/service/auth/block-user-account/block-user-account';
import { DeleteUserAccount } from '../../../core/service/auth/delete-user-account/delete-user-account';
import { FetchAllUsers } from '../../../core/service/auth/fetch-all-users/fetch-all-users';
import { FetchUser } from '../../../core/service/auth/fetch-user/fetch-user';
import { UnBlockUserAccount } from '../../../core/service/auth/un-block-user-account/un-block-user-account';
import { displayName } from '../../../core/service/auth/user-admin.service';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { CourseManager } from '../../course/course-manager/course-manager';

type Dialog =
  | { kind: 'block'; user: IUserResponse }
  | { kind: 'unblock'; user: IUserResponse }
  | { kind: 'delete' };

type Section = 'users' | 'courses';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'courses', label: 'Courses', icon: 'courses' },
];

/**
 * Admin console. Users: list, view, block / unblock. Courses: the same tools as the tutor
 * dashboard. Plus deleting your own account and signing out.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [
    BlockUserAccount,
    CourseManager,
    DashboardShell,
    DeleteUserAccount,
    FetchAllUsers,
    FetchUser,
    UnBlockUserAccount,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
  private readonly auth = inject(AuthService);

  /** `?section=` from the URL (bound by the router). */
  readonly section = input<string>();

  protected readonly sections = SECTIONS;
  protected readonly active = computed<Section>(() =>
    this.section() === 'courses' ? 'courses' : 'users',
  );

  protected readonly me = this.auth.user;
  private readonly firstName = computed(() => {
    const user = this.me();
    return user?.firstName || (user ? displayName(user) : 'Admin');
  });
  protected readonly heading = computed(() => (this.active() === 'courses' ? 'Courses' : 'Users'));
  protected readonly description = computed(() =>
    this.active() === 'courses'
      ? 'Create, search, edit and remove courses, and download them as PDF.'
      : `Welcome back, ${this.firstName()}. Here is everyone with an account.`,
  );
  /** The API refuses to delete super admin accounts. */
  protected readonly canDeleteSelf = computed(() => this.me()?.role !== UserRole.SUPER_ADMIN);

  protected readonly selectedUserId = signal<UUID | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly toast = signal<string | null>(null);

  protected openUser(user: IUserResponse): void {
    this.selectedUserId.set(user.id);
  }

  protected openDialog(dialog: Dialog): void {
    this.dialog.set(dialog);
  }

  protected onDialogDone(message: string): void {
    this.dialog.set(null);
    this.toast.set(message);
  }
}
