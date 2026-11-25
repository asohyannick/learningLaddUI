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
import { BookManager } from '../../library/book-manager/book-manager';
import { LoanManager } from '../../library/loan-manager/loan-manager';
import { JobApplicationManager } from '../../job-application/job-application-manager/job-application-manager';
import { JobListingManager } from '../../job-listing/job-listing-manager/job-listing-manager';
import { PartnerManager } from '../../partnership/partner-manager/partner-manager';
import { StudentProfileManager } from '../../student-profile/student-profile-manager/student-profile-manager';
import { TimeTableManager } from '../../time-table/time-table-manager/time-table-manager';
import { TutorProfileManager } from '../../tutor-profile/tutor-profile-manager/tutor-profile-manager';

type Dialog =
  | { kind: 'block'; user: IUserResponse }
  | { kind: 'unblock'; user: IUserResponse }
  | { kind: 'delete' };

type Section =
  | 'users'
  | 'students'
  | 'tutors'
  | 'courses'
  | 'timetable'
  | 'partners'
  | 'jobs'
  | 'applications'
  | 'library'
  | 'loans';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'students', label: 'Students', icon: 'students' },
  { id: 'tutors', label: 'Tutors', icon: 'tutors' },
  { id: 'courses', label: 'Courses', icon: 'courses' },
  { id: 'timetable', label: 'Timetable', icon: 'timetable' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'loans', label: 'Loans', icon: 'loans' },
  { id: 'partners', label: 'Partners', icon: 'partners' },
  { id: 'jobs', label: 'Job listings', icon: 'jobs' },
  { id: 'applications', label: 'Applications', icon: 'applications' },
];

const HEADINGS: Record<Section, string> = {
  users: 'Users',
  students: 'Student profiles',
  tutors: 'Tutor profiles',
  courses: 'Courses',
  timetable: 'Timetable',
  library: 'Library catalog',
  loans: 'Borrowed books',
  partners: 'Partners & sponsors',
  jobs: 'Job listings',
  applications: 'Job applications',
};

/**
 * Admin console. Users: list, view, block / unblock. Students and Tutors: their profiles.
 * Partners: partners and sponsors shown on the website.
 * Courses: the same tools as the tutor
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
    BookManager,
    JobApplicationManager,
    LoanManager,
    JobListingManager,
    PartnerManager,
    StudentProfileManager,
    TimeTableManager,
    TutorProfileManager,
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
  protected readonly active = computed<Section>(() => {
    const section = this.section();
    return section === 'courses' ||
      section === 'students' ||
      section === 'tutors' ||
      section === 'partners' ||
      section === 'timetable' ||
      section === 'jobs' ||
      section === 'applications' ||
      section === 'library' ||
      section === 'loans'
      ? section
      : 'users';
  });

  protected readonly me = this.auth.user;
  private readonly firstName = computed(() => {
    const user = this.me();
    return user?.firstName || (user ? displayName(user) : 'Admin');
  });
  protected readonly heading = computed(() => HEADINGS[this.active()]);
  protected readonly description = computed(() => {
    switch (this.active()) {
      case 'courses':
        return 'Create, search, edit and remove courses, and download them as PDF.';
      case 'students':
        return 'Search, open, edit and remove student profiles, and export them as PDF.';
      case 'tutors':
        return 'Search, open, edit and remove tutor profiles, and export them as PDF.';
      case 'timetable':
        return 'Schedule classes and sessions for every course, search and filter them, and export them as PDF.';
      case 'partners':
        return 'Add partners and sponsors, manage their agreements and tiers, and choose who appears on the website.';
      case 'jobs':
        return 'Post jobs, publish them to the careers page, search and filter them, and export them as PDF.';
      case 'applications':
        return 'Review who applied for each job, open their CVs and documents, and export applications as PDF.';
      case 'library':
        return 'Add, edit and remove books, manage copies and loan rules, and search the catalog.';
      case 'loans':
        return 'Issue reservations, confirm returns, handle late fees and lost books, and export loans as PDF.';
      default:
        return `Welcome back, ${this.firstName()}. Here is everyone with an account.`;
    }
  });
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
