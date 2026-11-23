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
 * Tutor console (professors, lecturers and super admins): create, list, search, count, view,
 * edit, delete and download courses. New sections are added to `SECTIONS` as they are built.
 */
@Component({
  selector: 'app-tutor-dashboard',
  imports: [CourseManager, DashboardShell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Tutor console"
      [sections]="sections"
      active="courses"
      heading="My courses"
      [description]="description()"
      [(toast)]="toast"
    >
      <app-course-manager (notify)="toast.set($event)" />
    </app-dashboard-shell>
  `,
})
export class TutorDashboard {
  private readonly me = inject(AuthService).user;

  protected readonly sections = SECTIONS;
  protected readonly toast = signal<string | null>(null);
  protected readonly description = computed(() => {
    const user = this.me();
    const name = user?.firstName || (user ? displayName(user) : '');
    return `${name ? `Welcome back, ${name}. ` : ''}Create and manage your courses, and download them as PDF.`;
  });
}
