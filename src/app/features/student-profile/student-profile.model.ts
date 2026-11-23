import { EnrollmentStatus, Gender } from '../../core/enum/global-enum-configuration';

export type { EnrollmentStatus };

/**
 * JSON for the `data` part of POST /api/v1/student-profile (multipart/form-data).
 * Mirrors CreateStudentProfileRequestDto. Only firstName and lastName are required.
 * Backend limits are noted on each field so the Reactive Form can use matching validators.
 */
export interface CreateStudentProfileRequest {
  /** Required. 2–255 characters; letters, spaces, apostrophes, periods, hyphens. */
  firstName: string;
  /** Required. 2–255 characters; letters, spaces, apostrophes, periods, hyphens. */
  lastName: string;
  /** "YYYY-MM-DD" (Java LocalDate), must be in the past. e.g. "2005-03-14" */
  dateOfBirth?: string;
  gender?: Gender;
  /** Max 100 characters. */
  nationality?: string;
  /** 7–30 characters: digits, spaces, ( ) -, optional leading +. e.g. "+237670000000" */
  phoneNumber?: string;
  /** Max 5,000 characters. */
  description?: string;
  /** Up to 20 items, each non-blank and max 100 characters. */
  hobbies?: string[];

  // Address
  /** Max 255 characters. */
  addressLine?: string;
  /** Max 100 characters. */
  city?: string;
  /** Max 100 characters. */
  stateRegion?: string;
  /** Max 20 characters. */
  postalCode?: string;
  /** Max 100 characters. */
  country?: string;

  // Academic
  /** Max 150 characters. */
  faculty?: string;
  /** Max 150 characters. */
  department?: string;
  /** Max 150 characters. */
  programOfStudy?: string;
  /** Year of study, whole number 1–10. */
  currentLevel?: number;

  // Emergency contact
  /** Max 150 characters. */
  emergencyContactName?: string;
  /** Same format as phoneNumber. */
  emergencyContactPhone?: string;
  /** Max 50 characters. */
  emergencyContactRelationship?: string;

  // Links
  /** Must start with https:// */
  linkedinUrl?: string;
  /** Must start with http:// or https:// */
  websiteUrl?: string;
}

/**
 * A student profile, as returned in `data` by GET /api/v1/student-profile/{id},
 * POST and PATCH. Mirrors StudentProfileResponseDto.
 * The backend omits null fields (@JsonInclude NON_NULL), so anything that can be null is optional.
 */
export interface StudentProfileResponse {
  id: string; // UUID
  userId: string; // UUID of the owning user account
  profilePictureUrl?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string; // "YYYY-MM-DD"
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];

  // Address
  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  // Academic
  studentNumber?: string; // assigned by the school
  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number; // year of study, 1–10
  enrollmentStatus?: EnrollmentStatus;
  admissionDate?: string; // "YYYY-MM-DD"
  expectedGraduationDate?: string; // "YYYY-MM-DD"
  gpa?: number; // Java BigDecimal, e.g. 3.75

  // Emergency contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  // Links
  linkedinUrl?: string;
  websiteUrl?: string;

  // Audit
  createdAt?: string; // ISO-8601 instant
  updatedAt?: string; // ISO-8601 instant
}

/** Optional file sent next to `data` in the multipart body. */
export interface StudentProfileFiles {
  /** JPEG, PNG, WebP or GIF, max 10 MB. */
  profilePicture?: File;
}

/**
 * The backend's regex rules, converted to JavaScript.
 * Java's \p{L} (any letter) needs the `u` flag in JS.
 * Use with Validators.pattern(...) in the form.
 */
export const STUDENT_PROFILE_PATTERNS = {
  name: /^[\p{L}][\p{L}\p{M} '.-]*$/u,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  linkedinUrl: /^https:\/\/.{3,250}$/,
  websiteUrl: /^https?:\/\/.{3,250}$/,
} as const;

/** JSON for the `data` part of PATCH /student-profile/{id}. Only the fields sent are changed. */
export type UpdateStudentProfileRequest = Partial<CreateStudentProfileRequest>;

/** An item of GET /student-profile and /search. Mirrors StudentProfileSummaryResponseDto. */
export interface StudentProfileSummary {
  id: string;
  profilePictureUrl?: string;
  firstName: string;
  lastName: string;
  email?: string;
  studentNumber?: string;
  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number;
  enrollmentStatus?: EnrollmentStatus;
  createdAt?: string;
}

export type StudentProfileSortField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'studentNumber'
  | 'currentLevel'
  | 'admissionDate'
  | 'createdAt'
  | 'updatedAt';

/** Query of GET /student-profile/search and /download. Mirrors StudentProfilePagedQueryDto. */
export interface StudentProfileSearchQuery {
  /** Matches full name, email or student number. Max 100 characters. */
  search?: string;
  /** Exact match, case-insensitive. */
  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number;
  enrollmentStatus?: EnrollmentStatus;
  /** "YYYY-MM-DD" */
  admittedFrom?: string;
  admittedTo?: string;
  page?: number;
  /** 1–100. Ignored by /download. */
  size?: number;
  sortBy?: StudentProfileSortField;
  sortDirection?: 'asc' | 'desc';
}
