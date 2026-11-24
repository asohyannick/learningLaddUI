/**
 * User roles mirroring the LearningLadder Java backend.
 * All enum values must match the backend exactly.
 */
export enum UserRole {
  // System Administration
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  IT_ADMIN = 'IT_ADMIN',

  // University Leadership
  VICE_CHANCELLOR = 'VICE_CHANCELLOR',
  DEPUTY_VICE_CHANCELLOR = 'DEPUTY_VICE_CHANCELLOR',
  REGISTRAR = 'REGISTRAR',
  DEPUTY_REGISTRAR = 'DEPUTY_REGISTRAR',
  ACADEMIC_DIRECTOR = 'ACADEMIC_DIRECTOR',

  // Academic Staff
  DEAN = 'DEAN',
  DEPUTY_DEAN = 'DEPUTY_DEAN',
  HEAD_OF_DEPARTMENT = 'HEAD_OF_DEPARTMENT',
  DEPUTY_HEAD_OF_DEPARTMENT = 'DEPUTY_HEAD_OF_DEPARTMENT',
  LECTURER = 'LECTURER',
  PROFESSOR = 'PROFESSOR',
  ASSISTANT_LECTURER = 'ASSISTANT_LECTURER',

  // Admissions & Registration
  ADMISSIONS_OFFICER = 'ADMISSIONS_OFFICER',
  ADMISSION_COMMITTEE = 'ADMISSION_COMMITTEE',
  STUDENT_REGISTRAR = 'STUDENT_REGISTRAR',

  // Finance
  BURSAR = 'BURSAR',
  ACCOUNTANT = 'ACCOUNTANT',
  FINANCE_OFFICER = 'FINANCE_OFFICER',

  // Human Resources
  HR_MANAGER = 'HR_MANAGER',
  HR_OFFICER = 'HR_OFFICER',

  // Examinations & Results
  EXAMINATION_OFFICER = 'EXAMINATION_OFFICER',
  RESULTS_OFFICER = 'RESULTS_OFFICER',

  // Library
  LIBRARIAN = 'LIBRARIAN',

  // Student Services
  STUDENT_AFFAIRS_OFFICER = 'STUDENT_AFFAIRS_OFFICER',
  COUNSELOR = 'COUNSELOR',
  STUDENT = 'STUDENT',

  // Parents
  PARENT = 'PARENT',
}

/**
 * Roles authorized to access the system administration dashboard.
 */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
];

export const CourseLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  ALL_LEVELS: 'ALL_LEVELS',
} as const;

export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const COURSE_LEVELS = Object.values(CourseLevel);

export const CourseStatus = {
  PAID: 'PAID',
  FREE: 'FREE',
  COMPLETED: 'COMPLETED',
  UNCOMPLETED: 'UNCOMPLETED',
} as const;

export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const COURSE_STATUSES = Object.values(CourseStatus);

/** Roles that can open the tutor dashboard. */
export const TUTOR_DASHBOARD_ROLES: readonly UserRole[] = [
  UserRole.PROFESSOR,
  UserRole.LECTURER,
  UserRole.SUPER_ADMIN,
];

/** May create and update courses (mirrors `@PreAuthorize(WRITE_ROLES)` on the course API). */
export const COURSE_WRITE_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACADEMIC_DIRECTOR,
  UserRole.DEAN,
  UserRole.HEAD_OF_DEPARTMENT,
  UserRole.PROFESSOR,
  UserRole.LECTURER,
];

/** May delete courses (mirrors `DELETE /course/{id}` on the backend). */
export const COURSE_DELETE_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACADEMIC_DIRECTOR,
];

/** Mirrors the backend enum com.learningLadder...enums.gender.Gender */
export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDERS = Object.values(Gender);

/** Mirrors the backend enum EnrollmentStatus. */
export const EnrollmentStatus = {
  APPLICANT: 'APPLICANT',
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  GRADUATED: 'GRADUATED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const ENROLLMENT_STATUSES = Object.values(EnrollmentStatus);

/**
 * Who may list, open, search, count and export student profiles
 * (`StudentProfileController.STAFF`). Students cannot read profiles, not even their own.
 */
export const STUDENT_PROFILE_STAFF_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
  UserRole.REGISTRAR,
  UserRole.DEPUTY_REGISTRAR,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.STUDENT_REGISTRAR,
];

/** Who may update or delete any student's profile; a student may change only their own. */
export const STUDENT_PROFILE_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
];

/** Mirrors the backend enum TutorStatus. New profiles start as PENDING_APPROVAL. */
export const TutorStatus = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;

export type TutorStatus = (typeof TutorStatus)[keyof typeof TutorStatus];

export const TUTOR_STATUSES = Object.values(TutorStatus);

/** Who may create a tutor profile (`TutorProfileController.TUTORS`). */
export const TUTOR_PROFILE_CREATE_ROLES: readonly UserRole[] = [
  UserRole.LECTURER,
  UserRole.PROFESSOR,
  UserRole.ASSISTANT_LECTURER,
  UserRole.SUPER_ADMIN,
];

/**
 * Who may list, open, search, count and export tutor profiles (`TutorProfileController.STAFF`).
 * Students may browse tutors; tutors themselves (other than super admins) cannot read profiles.
 */
export const TUTOR_PROFILE_READ_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
  UserRole.REGISTRAR,
  UserRole.DEPUTY_REGISTRAR,
  UserRole.ADMISSIONS_OFFICER,
  UserRole.STUDENT_REGISTRAR,
  UserRole.STUDENT,
];

/** Who may update or delete any tutor's profile; a tutor may change only their own. */
export const TUTOR_PROFILE_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
];

/** May delete timetable entries (mirrors `TIMETABLE_DELETE_ROLES` on the backend). */
export const TIMETABLE_DELETE_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
  UserRole.ACADEMIC_DIRECTOR,
];
