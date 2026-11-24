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

export type DashboardIcon = 'users' | 'courses' | 'profile' | 'students' | 'tutors' | 'partners';

/** One sidebar entry. Selecting it sets `?section=<id>` on the current dashboard URL. */
export interface DashboardSection {
  id: string;
  label: string;
  icon: DashboardIcon;
}

const TOAST_MS = 5_000;

/**
 * Dark dashboard layout: sidebar with sections and account actions, top bar with the signed-in
 * user, page heading and a success toast. The page content goes inside.
 */
@Component({
  selector: 'app-dashboard-shell',
  imports: [EnumLabelPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-shell.html',
})
export class DashboardShell {
  private readonly auth = inject(AuthService);

  /** Shown under the logo, e.g. "Admin console". */
  readonly consoleLabel = input.required<string>();
  readonly sections = input.required<readonly DashboardSection[]>();
  /** ID of the section on screen. */
  readonly active = input.required<string>();
  readonly heading = input.required<string>();
  readonly description = input<string>();
  /** `null` hides "Delete my account"; `false` shows it disabled. */
  readonly canDeleteAccount = input<boolean | null>(null);
  readonly deleteAccountDisabledReason = input<string>();
  readonly deleteAccount = output<void>();
  /** Success message; it hides itself after a few seconds. */
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
