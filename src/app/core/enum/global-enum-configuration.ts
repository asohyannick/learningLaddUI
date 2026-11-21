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
