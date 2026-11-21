/**
 * User roles, mirroring the backend (values must match exactly).
 * TODO: confirm the full list against the backend `Role` enum. Swagger does not publish it yet.
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  IT_ADMIN = 'IT_ADMIN',
  STUDENT = 'STUDENT',
  TUTOR = 'TUTOR',
  LECTURER = 'LECTURER',
  LIBRARIAN = 'LIBRARIAN',
}

/** Roles that can open the admin dashboard and admin tools. */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.IT_ADMIN,
];
