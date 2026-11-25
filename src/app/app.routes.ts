import { Routes } from '@angular/router';
import {
  ADMIN_ROLES,
  TUTOR_DASHBOARD_ROLES,
  UserRole,
} from './core/enum/global-enum-configuration';
import { authGuard, guestGuard, magicLinkTokenGuard, roleGuard } from './core/guard/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Learning Ladder',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'partners',
    title: 'Partners | Learning Ladder',
    loadComponent: () => import('./features/partnership/partnership').then((m) => m.Partnership),
  },
  {
    path: 'partners/:slug',
    title: 'Partner | Learning Ladder',
    loadComponent: () =>
      import('./features/partnership/partner-page/partner-page').then((m) => m.PartnerPage),
  },
  {
    path: 'jobs',
    title: 'Careers | Learning Ladder',
    loadComponent: () => import('./features/job-listing/job-listing').then((m) => m.JobListing),
  },
  {
    path: 'jobs/:id',
    title: 'Job | Learning Ladder',
    loadComponent: () =>
      import('./features/job-listing/job-detail/job-detail').then((m) => m.JobDetail),
  },

  {
    path: 'reset-password',
    title: 'Reset password | Learning Ladder',
    loadComponent: () =>
      import('./core/service/auth/reset-password/reset-password').then((m) => m.ResetPassword),
  },
  {
    path: 'logout',
    title: 'Signing out | Learning Ladder',
    loadComponent: () => import('./core/service/auth/logout/logout').then((m) => m.Logout),
  },

  {
    path: '',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        title: 'Log in | Learning Ladder',
        loadComponent: () => import('./core/service/auth/login/login').then((m) => m.Login),
      },
      {
        path: 'register',
        title: 'Create account | Learning Ladder',
        loadComponent: () =>
          import('./core/service/auth/register/register').then((m) => m.Register),
      },
      {
        path: 'verify-otp',
        title: 'Verify your email | Learning Ladder',
        loadComponent: () =>
          import('./core/service/auth/verify-otp/verify-otp').then((m) => m.VerifyOtp),
      },
      {
        path: 'forgot-password',
        title: 'Forgot password | Learning Ladder',
        loadComponent: () =>
          import('./core/service/auth/forgot-password/forgot-password').then(
            (m) => m.ForgotPassword,
          ),
      },
      {
        path: 'magic-link',
        title: 'Sign in with a link | Learning Ladder',
        canActivate: [magicLinkTokenGuard],
        loadComponent: () =>
          import('./core/service/auth/login-via-magic-link/login-via-magic-link').then(
            (m) => m.LoginViaMagicLink,
          ),
      },
      {
        path: 'magic-link/verify',
        title: 'Signing you in | Learning Ladder',
        loadComponent: () =>
          import('./core/service/auth/verify-magic-link/verify-magic-link').then(
            (m) => m.VerifyMagicLink,
          ),
      },
    ],
  },

  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'courses',
        title: 'Courses | Learning Ladder',
        loadComponent: () => import('./features/course/course').then((m) => m.Course),
      },
      {
        path: 'time-table',
        title: 'Time table | Learning Ladder',
        loadComponent: () => import('./features/time-table/time-table').then((m) => m.TimeTable),
      },
      {
        path: 'library',
        title: 'Library | Learning Ladder',
        loadComponent: () => import('./features/library/library').then((m) => m.Library),
      },
      {
        path: 'reviews',
        title: 'Reviews | Learning Ladder',
        loadComponent: () => import('./features/review/review').then((m) => m.Review),
      },
      {
        path: 'bookings',
        title: 'Bookings | Learning Ladder',
        loadComponent: () => import('./features/booking/booking').then((m) => m.Booking),
      },
      {
        path: 'cart',
        title: 'Cart | Learning Ladder',
        loadComponent: () =>
          import('./features/shopping-cart/shopping-cart').then((m) => m.ShoppingCart),
      },
      {
        path: 'payments',
        title: 'Payments | Learning Ladder',
        loadComponent: () => import('./features/payment/payment').then((m) => m.Payment),
      },
      {
        path: 'coupons',
        title: 'Coupons | Learning Ladder',
        loadComponent: () => import('./features/coupon/coupon').then((m) => m.Coupon),
      },
      {
        path: 'job-applications',
        title: 'Job applications | Learning Ladder',
        loadComponent: () =>
          import('./features/job-application/job-application').then((m) => m.JobApplication),
      },
      {
        path: 'assistant',
        title: 'AI assistant | Learning Ladder',
        loadComponent: () =>
          import('./features/ai-assistant/ai-assistant').then((m) => m.AiAssistant),
      },
      {
        path: 'profile/student',
        title: 'Student profile | Learning Ladder',
        loadComponent: () =>
          import('./features/student-profile/student-profile').then((m) => m.StudentProfile),
      },
      {
        path: 'profile/tutor',
        title: 'Tutor profile | Learning Ladder',
        loadComponent: () =>
          import('./features/tutor-profile/tutor-profile').then((m) => m.TutorProfile),
      },
    ],
  },

  {
    path: 'dashboard/admin',
    title: 'Admin dashboard | Learning Ladder',
    canActivate: [roleGuard(ADMIN_ROLES)],
    loadComponent: () =>
      import('./features/dashboard/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
  },
  {
    path: 'dashboard/tutor',
    title: 'Tutor dashboard | Learning Ladder',
    canActivate: [roleGuard(TUTOR_DASHBOARD_ROLES)],
    loadComponent: () =>
      import('./features/dashboard/tutor-dashboard/tutor-dashboard').then((m) => m.TutorDashboard),
  },
  {
    path: 'dashboard/librarian',
    title: 'Librarian dashboard | Learning Ladder',
    canActivate: [roleGuard([UserRole.LIBRARIAN])],
    loadComponent: () =>
      import('./features/dashboard/librarian-dashboard/librarian-dashboard').then(
        (m) => m.LibrarianDashboard,
      ),
  },
  {
    path: 'dashboard/student',
    title: 'Student dashboard | Learning Ladder',
    canActivate: [roleGuard([UserRole.STUDENT])],
    loadComponent: () =>
      import('./features/dashboard/student-dashboard/student-dashboard').then(
        (m) => m.StudentDashboard,
      ),
  },

  { path: '**', redirectTo: '' },
];
