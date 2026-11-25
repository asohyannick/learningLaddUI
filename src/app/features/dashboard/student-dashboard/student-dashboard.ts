import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AuthService } from '../../../core/service/auth/auth.service';
import { displayName } from '../../../core/service/auth/user-admin.service';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { BookingManager } from '../../booking/booking-manager/booking-manager';
import { BookManager } from '../../library/book-manager/book-manager';
import { LoanManager } from '../../library/loan-manager/loan-manager';
import { CourseManager } from '../../course/course-manager/course-manager';
import { MyStudentProfile } from '../../student-profile/my-student-profile/my-student-profile';
import { TimeTableManager } from '../../time-table/time-table-manager/time-table-manager';
import { TutorProfileManager } from '../../tutor-profile/tutor-profile-manager/tutor-profile-manager';

type Section = 'courses' | 'timetable' | 'library' | 'loans' | 'bookings' | 'tutors' | 'profile';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'courses', label: 'Courses', icon: 'courses' },
  { id: 'timetable', label: 'Timetable', icon: 'timetable' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'loans', label: 'My loans', icon: 'loans' },
  { id: 'bookings', label: 'My bookings', icon: 'bookings' },
  { id: 'tutors', label: 'Find a tutor', icon: 'tutors' },
  { id: 'profile', label: 'My profile', icon: 'profile' },
];

const HEADINGS: Record<Section, string> = {
  courses: 'Courses',
  timetable: 'Timetable',
  library: 'Library',
  loans: 'My loans',
  bookings: 'My bookings',
  tutors: 'Find a tutor',
  profile: 'My profile',
};

/**
 * Student console. Courses: browse, search, open and download as PDF (read-only for students).
 * Timetable: every course's classes; search, open, add and edit entries, and download them as PDF.
 * Find a tutor: browse, search, open and download tutor profiles (read-only).
 * My profile: create, update and delete the student's own profile.
 */
@Component({
  selector: 'app-student-dashboard',
  imports: [
    BookManager,
    CourseManager,
    DashboardShell,
    LoanManager,
    BookingManager,
    MyStudentProfile,
    TimeTableManager,
    TutorProfileManager,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Student portal"
      [sections]="sections"
      [active]="active()"
      [heading]="heading()"
      [description]="description()"
      [(toast)]="toast"
    >
      @switch (active()) {
        @case ('profile') {
          <app-my-student-profile (notify)="toast.set($event)" />
        }
        @case ('library') {
          <app-book-manager (notify)="toast.set($event)" />
        }
        @case ('bookings') {
          <app-booking-manager mode="student" (notify)="toast.set($event)" />
        }
        @case ('loans') {
          <app-loan-manager mode="student" (notify)="toast.set($event)" />
        }
        @case ('timetable') {
          <app-time-table-manager (notify)="toast.set($event)" />
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
export class StudentDashboard {
  private readonly me = inject(AuthService).user;

  /** `?section=` from the URL (bound by the router). */
  readonly section = input<string>();

  protected readonly sections = SECTIONS;
  protected readonly active = computed<Section>(() => {
    const section = this.section();
    return section === 'profile' ||
      section === 'tutors' ||
      section === 'timetable' ||
      section === 'library' ||
      section === 'loans' ||
      section === 'bookings'
      ? section
      : 'courses';
  });
  protected readonly heading = computed(() => HEADINGS[this.active()]);
  protected readonly toast = signal<string | null>(null);
  protected readonly description = computed(() => {
    switch (this.active()) {
      case 'profile':
        return 'Your personal details, studies and emergency contact.';
      case 'timetable':
        return 'Classes and sessions for every course. Find yours by course, day or time, add a session, or download the timetable as PDF.';
      case 'library':
        return 'Find books by title, author or ISBN and reserve a copy; pick it up at the library desk within 48 hours.';
      case 'bookings':
        return 'Book one-to-one sessions with tutors, track approvals, and change or reschedule a booking.';
      case 'loans':
        return 'Your reservations and borrowed books: renew, return, cancel a reservation or report a lost book.';
      case 'tutors':
        return 'Find tutors by subject, experience or name, and see their rates and qualifications.';
      default: {
        const user = this.me();
        const name = user?.firstName || (user ? displayName(user) : '');
        return `${name ? `Welcome back, ${name}. ` : ''}Browse every course, open one for the details, or download it as PDF.`;
      }
    }
  });
}
