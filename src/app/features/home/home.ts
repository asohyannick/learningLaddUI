import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiErrorResponse, CourseSummary, isApiErrorResponse } from '../../core/interface';
import { AuthService } from '../../core/service/auth/auth.service';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { CourseCard } from '../course/course-card/course-card';
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

/** Two rows of three on large screens. */
const FEATURED_COURSES = 6;

interface Step {
  number: string;
  title: string;
  description: string;
  /** Raises each card a little more than the one before it, like rungs on a ladder. */
  offsetClass: string;
  highlighted: boolean;
}

/** Public landing page. */
@Component({
  selector: 'app-home',
  imports: [CourseCard, NgOptimizedImage, RouterLink, SiteHeader, SiteFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
})
export class Home {
  protected readonly account = injectHeaderAccount();
  private readonly homeService = inject(HomeService);

  protected readonly isSignedIn = inject(AuthService).isAuthenticated;

  /** Loaded only for signed-in users: the course API returns 401 to guests. */
  protected readonly courses = rxResource({
    params: () => (this.isSignedIn() ? true : undefined),
    stream: () => this.homeService.getFeaturedCourses(FEATURED_COURSES),
  });

  protected readonly courseCards = computed<CourseSummary[]>(() =>
    this.courses.hasValue() ? this.courses.value().content : [],
  );

  /** Number of published courses, for the "View all" link. */
  protected readonly publishedTotal = computed(() =>
    this.courses.hasValue() ? this.courses.value().totalElements : 0,
  );

  protected readonly coursesErrorMessage = computed(() => {
    const error = this.courses.error() as ApiErrorResponse | Error | undefined;
    return isApiErrorResponse(error) ? error.message : 'Please try again in a moment.';
  });

  /** Public partners. The section stays hidden while loading, on error or when there are none. */
  protected readonly partners = rxResource({
    stream: () => this.homeService.getPartners(5),
  });

  protected readonly partnerList = computed(() =>
    this.partners.hasValue() ? this.partners.value() : [],
  );

  protected readonly skeletonSlots = Array.from({ length: FEATURED_COURSES }, (_, i) => i);

  /** Course progress shown in the hero preview: 6 of 8 lessons done. */
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
