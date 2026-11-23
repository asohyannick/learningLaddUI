import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/service/auth/auth.service';
import { displayName } from '../../../core/service/auth/user-admin.service';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { CourseManager } from '../../course/course-manager/course-manager';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'courses', label: 'Courses', icon: 'courses' },
];

/**
 * Student console: browse, search and open every course, and download it as PDF.
 * The course tools are read-only for students (the API only lets staff write).
 */
@Component({
  selector: 'app-student-dashboard',
  imports: [CourseManager, DashboardShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Student portal"
      [sections]="sections"
      active="courses"
      heading="Courses"
      [description]="description()"
      [(toast)]="toast"
    >
      <app-course-manager (notify)="toast.set($event)" />
    </app-dashboard-shell>
  `,
})
export class StudentDashboard {
  private readonly me = inject(AuthService).user;

  protected readonly sections = SECTIONS;
  protected readonly toast = signal<string | null>(null);
  protected readonly description = computed(() => {
    const user = this.me();
    const name = user?.firstName || (user ? displayName(user) : '');
    return `${name ? `Welcome back, ${name}. ` : ''}Browse every course, open one for the details, or download it as PDF.`;
  });
}
