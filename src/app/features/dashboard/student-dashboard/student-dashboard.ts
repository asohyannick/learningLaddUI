import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AuthService } from '../../../core/service/auth/auth.service';
import { displayName } from '../../../core/service/auth/user-admin.service';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { CourseManager } from '../../course/course-manager/course-manager';
import { MyStudentProfile } from '../../student-profile/my-student-profile/my-student-profile';

type Section = 'courses' | 'profile';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'courses', label: 'Courses', icon: 'courses' },
  { id: 'profile', label: 'My profile', icon: 'profile' },
];

/**
 * Student console. Courses: browse, search, open and download as PDF (read-only for students).
 * My profile: create, update and delete the student's own profile.
 */
@Component({
  selector: 'app-student-dashboard',
  imports: [CourseManager, DashboardShell, MyStudentProfile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Student portal"
      [sections]="sections"
      [active]="active()"
      [heading]="active() === 'profile' ? 'My profile' : 'Courses'"
      [description]="description()"
      [(toast)]="toast"
    >
      @if (active() === 'profile') {
        <app-my-student-profile (notify)="toast.set($event)" />
      } @else {
        <app-course-manager (notify)="toast.set($event)" />
      }
    </app-dashboard-shell>
  `,
})
export class StudentDashboard {
  private readonly me = inject(AuthService).user;

  /** `?section=` from the URL (bound by the router). */
  readonly section = input<string>();

  protected readonly sections = SECTIONS;
  protected readonly active = computed<Section>(() =>
    this.section() === 'profile' ? 'profile' : 'courses',
  );
  protected readonly toast = signal<string | null>(null);
  protected readonly description = computed(() => {
    if (this.active() === 'profile') {
      return 'Your personal details, studies and emergency contact.';
    }
    const user = this.me();
    const name = user?.firstName || (user ? displayName(user) : '');
    return `${name ? `Welcome back, ${name}. ` : ''}Browse every course, open one for the details, or download it as PDF.`;
  });
}
