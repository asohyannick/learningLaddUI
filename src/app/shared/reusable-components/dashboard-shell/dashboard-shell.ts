import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/service/auth/auth.service';
import { displayName, initials } from '../../../core/service/auth/user-admin.service';
import { EnumLabelPipe } from '../../custom-pipe/enum-label-pipe';

export type DashboardIcon =
  | 'users'
  | 'courses'
  | 'profile'
  | 'students'
  | 'tutors'
  | 'partners'
  | 'timetable'
  | 'jobs'
  | 'applications'
  | 'library'
  | 'loans'
  | 'bookings';

export interface DashboardSection {
  id: string;
  label: string;
  icon: DashboardIcon;
}

const TOAST_MS = 5_000;

@Component({
  selector: 'app-dashboard-shell',
  imports: [EnumLabelPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-shell.html',
})
export class DashboardShell {
  private readonly auth = inject(AuthService);

  readonly consoleLabel = input.required<string>();
  readonly sections = input.required<readonly DashboardSection[]>();
  readonly active = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly canDeleteAccount = input<boolean | null>(null);
  readonly deleteAccountDisabledReason = input<string>();
  readonly deleteAccount = output<void>();
  readonly toast = model<string | null>(null);

  protected readonly me = this.auth.user;
  protected readonly myName = computed(() => {
    const user = this.me();
    return user ? displayName(user) : 'Account';
  });
  protected readonly myInitials = computed(() => {
    const user = this.me();
    return user ? initials(user) : '?';
  });

  protected readonly sidebarOpen = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.toast()) return;
      const timer = setTimeout(() => this.toast.set(null), TOAST_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected onDeleteAccount(): void {
    this.sidebarOpen.set(false);
    this.deleteAccount.emit();
  }
}
