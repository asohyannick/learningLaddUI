import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TUTOR_PROFILE_READ_ROLES } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { displayName } from '../../../core/service/auth/user-admin.service';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { BookingManager } from '../../booking/booking-manager/booking-manager';
import { CourseManager } from '../../course/course-manager/course-manager';
import { MyTutorProfile } from '../../tutor-profile/my-tutor-profile/my-tutor-profile';
import { TutorProfileManager } from '../../tutor-profile/tutor-profile-manager/tutor-profile-manager';

type Section = 'courses' | 'bookings' | 'profile' | 'tutors';

const COURSES: DashboardSection = { id: 'courses', label: 'Courses', icon: 'courses' };
const BOOKINGS: DashboardSection = { id: 'bookings', label: 'Bookings', icon: 'bookings' };
const PROFILE: DashboardSection = { id: 'profile', label: 'My profile', icon: 'profile' };
const TUTORS: DashboardSection = { id: 'tutors', label: 'Tutors', icon: 'tutors' };

const HEADINGS: Record<Section, string> = {
  courses: 'My courses',
  bookings: 'My bookings',
  profile: 'My tutor profile',
  tutors: 'Tutor profiles',
};

/**
 * Tutor console (professors, lecturers and super admins).
 * Courses: create, list, search, count, view, edit, delete and download as PDF.
 * Bookings: sessions students booked with this tutor (all bookings for super admins): approve,
 * decline, delete, search, count and PDF. The API limits tutors to their own bookings.
 * My profile: create, update and delete the tutor's own profile.
 * Tutors (super admins only, since only they may read profiles): the tutor directory.
 */
@Component({
  selector: 'app-tutor-dashboard',
  imports: [BookingManager, CourseManager, DashboardShell, MyTutorProfile, TutorProfileManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Tutor console"
      [sections]="sections()"
      [active]="active()"
      [heading]="heading()"
      [description]="description()"
      [(toast)]="toast"
    >
      @switch (active()) {
        @case ('bookings') {
          <app-booking-manager mode="staff" (notify)="toast.set($event)" />
        }
        @case ('profile') {
          <app-my-tutor-profile (notify)="toast.set($event)" />
        }
        @case ('tutors') {
          <app-tutor-profile-manager (notify)="toast.set($event)" />
        }
        @default {
          <app-course-manager (notify)="toast.set($event)" />
        }
      }
    </app-dashboard-shell>
  `,
})
export class TutorDashboard {
  private readonly auth = inject(AuthService);
  private readonly me = this.auth.user;

  /** `?section=` from the URL (bound by the router). */
  readonly section = input<string>();

  private readonly canBrowseTutors = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(TUTOR_PROFILE_READ_ROLES);
  });
  protected readonly sections = computed<readonly DashboardSection[]>(() =>
    this.canBrowseTutors() ? [COURSES, BOOKINGS, PROFILE, TUTORS] : [COURSES, BOOKINGS, PROFILE],
  );
  protected readonly active = computed<Section>(() => {
    const section = this.section();
    if (section === 'profile') return 'profile';
    if (section === 'bookings') return 'bookings';
    if (section === 'tutors' && this.canBrowseTutors()) return 'tutors';
    return 'courses';
  });
  protected readonly heading = computed(() => HEADINGS[this.active()]);
  protected readonly toast = signal<string | null>(null);
  protected readonly description = computed(() => {
    switch (this.active()) {
      case 'bookings':
        return 'Sessions students booked with you: approve or decline requests, search, export as PDF or delete.';
      case 'profile':
        return 'What students see when they look for a tutor: your subjects, experience and rate.';
      case 'tutors':
        return 'Search, open, edit and remove tutor profiles, and export them as PDF.';
      default: {
        const user = this.me();
        const name = user?.firstName || (user ? displayName(user) : '');
        return `${name ? `Welcome back, ${name}. ` : ''}Create and manage your courses, and download them as PDF.`;
      }
    }
  });
}
