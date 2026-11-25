import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CourseSummary } from '../../core/interface';
import { resourceErrorMessage } from '../../shared/utils/resource-error';
import { AuthService } from '../../core/service/auth/auth.service';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { CourseCard } from '../course/course-card/course-card';
import { JobCard } from '../job-listing/job-card/job-card';
import { JobListingService } from '../job-listing/job-listing.service';
import { PartnerCarousel } from '../partnership/partner-carousel/partner-carousel';
import { PartnershipService } from '../partnership/partnership.service';
import { HomeService } from './home.service';
import { injectHeaderAccount } from '../../core/service/auth/header-account';

type FeatureIcon = 'courses' | 'timetable' | 'tutor' | 'library' | 'payments' | 'assistant';

interface PlatformFeature {
  title: string;
  description: string;
  path: string;
  icon: FeatureIcon;
}

interface RoleCard {
  role: string;
  badgeClass: string;
  items: readonly string[];
}

const FEATURED_COURSES = 6;

const FEATURED_JOBS = 3;

interface Step {
  number: string;
  title: string;
  description: string;
  offsetClass: string;
  highlighted: boolean;
}

@Component({
  selector: 'app-home',
  imports: [CourseCard, JobCard, PartnerCarousel, RouterLink, SiteHeader, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
})
export class Home {
  protected readonly account = injectHeaderAccount();
  private readonly homeService = inject(HomeService);
  private readonly partnershipService = inject(PartnershipService);
  private readonly jobListingService = inject(JobListingService);

  protected readonly isSignedIn = inject(AuthService).isAuthenticated;

  protected readonly courses = rxResource({
    params: () => (this.isSignedIn() ? true : undefined),
    stream: () => this.homeService.getFeaturedCourses(FEATURED_COURSES),
  });

  protected readonly courseCards = computed<CourseSummary[]>(() =>
    this.courses.hasValue() ? this.courses.value().content : [],
  );

  protected readonly publishedTotal = computed(() =>
    this.courses.hasValue() ? this.courses.value().totalElements : 0,
  );

  protected readonly coursesErrorMessage = computed(() =>
    resourceErrorMessage(this.courses.error()),
  );

  protected readonly partners = rxResource({
    stream: () => this.partnershipService.getAllPublicPartners(),
  });

  protected readonly partnerList = computed(() =>
    this.partners.hasValue() ? this.partners.value() : [],
  );

  protected readonly jobs = rxResource({
    params: () => (this.isSignedIn() ? true : undefined),
    stream: () => this.jobListingService.searchOpenJobListings({ page: 0, size: FEATURED_JOBS }),
  });
  protected readonly jobCards = computed(() =>
    this.jobs.hasValue() ? this.jobs.value().content : [],
  );
  protected readonly openJobsTotal = computed(() =>
    this.jobs.hasValue() ? this.jobs.value().totalElements : 0,
  );
  protected readonly jobsErrorMessage = computed(() => resourceErrorMessage(this.jobs.error()));
  protected readonly jobSkeletons = [1, 2, 3];

  protected readonly skeletonSlots = Array.from({ length: FEATURED_COURSES }, (_, i) => i);

  protected readonly lessons = Array.from({ length: 8 }, (_, i) => i < 6);

  protected readonly features: readonly PlatformFeature[] = [
    {
      title: 'Courses & materials',
      description: 'Browse, buy and study courses with videos, syllabuses and downloadable PDFs.',
      path: '/courses',
      icon: 'courses',
    },
    {
      title: 'Timetables',
      description: 'Online and in-person classes, recurring sessions and rooms, always up to date.',
      path: '/time-table',
      icon: 'timetable',
    },
    {
      title: 'Tutor bookings',
      description: 'Book one-to-one sessions; tutors approve and share the meeting link.',
      path: '/bookings',
      icon: 'tutor',
    },
    {
      title: 'Library',
      description: 'Reserve, borrow, renew and return books, with due-date reminders.',
      path: '/library',
      icon: 'library',
    },
    {
      title: 'Payments & fees',
      description: 'Pay for courses and school fees securely with Stripe, and keep every receipt.',
      path: '/payments',
      icon: 'payments',
    },
    {
      title: 'AI study assistants',
      description: 'Ask course-aware assistants for explanations, practice and revision help.',
      path: '/assistant',
      icon: 'assistant',
    },
  ];

  protected readonly roles: readonly RoleCard[] = [
    {
      role: 'Students',
      badgeClass: 'bg-ladder text-ink',
      items: [
        'Enrol and track progress',
        'See your timetable',
        'Book tutors',
        'Borrow library books',
        'Pay fees online',
      ],
    },
    {
      role: 'Tutors',
      badgeClass: 'bg-royal text-white',
      items: ['Publish courses', 'Approve session bookings', 'Reply to reviews', 'Issue coupons'],
    },
    {
      role: 'Librarians',
      badgeClass: 'bg-royal-soft text-royal',
      items: [
        'Manage the catalogue',
        'Issue and receive books',
        'Track overdue loans',
        'Apply late fees',
      ],
    },
    {
      role: 'Administrators',
      badgeClass: 'bg-navy-900 text-white',
      items: [
        'Manage users and roles',
        'Run payroll and refunds',
        'Moderate reviews',
        'Export reports as PDF',
      ],
    },
  ];

  protected readonly steps: readonly Step[] = [
    {
      number: '01',
      title: 'Create your account',
      description: 'Sign up with email or Google in under a minute.',
      offsetClass: 'lg:mt-12',
      highlighted: false,
    },
    {
      number: '02',
      title: 'Verify your email',
      description: 'Enter the 6-digit code we send you.',
      offsetClass: 'lg:mt-8',
      highlighted: false,
    },
    {
      number: '03',
      title: 'Complete your profile',
      description: 'Add your faculty, department and level.',
      offsetClass: 'lg:mt-4',
      highlighted: false,
    },
    {
      number: '04',
      title: 'Start learning',
      description: 'Enrol, book tutors and track your progress.',
      offsetClass: 'lg:mt-0',
      highlighted: true,
    },
  ];
}
