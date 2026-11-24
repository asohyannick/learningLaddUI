import { Gender, TutorStatus } from '../../core/enum/global-enum-configuration';

/**
 * JSON for the `data` part of POST /api/v1/tutor-profile (multipart/form-data).
 * Mirrors CreateTutorProfileRequestDto. Only firstName and lastName are required.
 * Backend limits are noted on each field so the Reactive Form can use matching validators.
 *
 * Cross-field rule: if `hourlyRate` is set, `currency` is required.
 */
export interface CreateTutorProfileRequest {
  /** Required. 2–255 characters; letters, spaces, apostrophes, periods, hyphens. */
  firstName: string;
  /** Required. 2–255 characters; letters, spaces, apostrophes, periods, hyphens. */
  lastName: string;
  /** Courtesy or academic title, max 30 characters. e.g. "Dr." */
  title?: string;
  /** "YYYY-MM-DD" (Java LocalDate), must be in the past. e.g. "1988-03-14" */
  dateOfBirth?: string;
  gender?: Gender;
  /** Max 100 characters. */
  nationality?: string;
  /** 7–30 characters: digits, spaces, ( ) -, optional leading +. e.g. "+237670000000" */
  phoneNumber?: string;
  /** Short bio shown on the tutor's profile, max 5,000 characters. */
  description?: string;
  /** Up to 20 items, each non-blank and max 100 characters. */
  hobbies?: string[];
  /** Languages the tutor teaches in: up to 15, each max 100 characters. e.g. ["English", "French"] */
  languages?: string[];

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

  // Academic / professional
  /** Max 150 characters. */
  faculty?: string;
  /** Max 150 characters. */
  department?: string;
  /** Max 150 characters. e.g. "MSc Computer Science" */
  highestQualification?: string;
  /** Max 150 characters. e.g. "Machine Learning" */
  fieldOfSpecialization?: string;
  /** Up to 30 items, each max 150 characters. e.g. ["Calculus", "Linear Algebra"] */
  subjects?: string[];
  /** Up to 20 items, each max 255 characters. */
  certifications?: string[];
  /** Whole number, 0–60. */
  yearsOfExperience?: number;

  // Pricing
  /** Price per hour in `currency`. ≥ 0, max 8 digits and 2 decimals. e.g. 25.00 */
  hourlyRate?: number;
  /** 3-letter ISO 4217 code (any case), e.g. "XAF", "NGN", "USD". Required when hourlyRate is set. */
  currency?: string;

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
 * JSON for the `data` part of PATCH /api/v1/tutor-profile/{id} (multipart/form-data).
 * Mirrors UpdateTutorProfileRequestDto: the same fields and limits as
 * CreateTutorProfileRequest, but every field is optional. Send only what changed.
 *
 * Unlike create, the backend does NOT require `currency` when `hourlyRate` is sent,
 * so send both together if the profile has no currency yet.
 */
export type UpdateTutorProfileRequest = Partial<CreateTutorProfileRequest>;

export type { TutorStatus };

/**
 * A tutor profile, as returned in `data` by GET /api/v1/tutor-profile/{id},
 * POST and PATCH. Mirrors TutorProfileResponseDto.
 * The backend omits null fields (@JsonInclude NON_NULL), so anything that can be null is optional.
 */
export interface TutorProfileResponse {
  id: string; // UUID
  userId: string; // UUID of the owning user account
  profilePictureUrl?: string;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  dateOfBirth?: string; // "YYYY-MM-DD"
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];
  languages?: string[];

  // Address
  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  // Academic / professional
  tutorNumber?: string; // assigned by the school
  faculty?: string;
  department?: string;
  highestQualification?: string;
  fieldOfSpecialization?: string;
  subjects?: string[];
  certifications?: string[];
  yearsOfExperience?: number;

  // Pricing
  hourlyRate?: number; // Java BigDecimal, e.g. 25.00
  currency?: string;

  // Employment
  status?: TutorStatus;
  joinedDate?: string; // "YYYY-MM-DD"

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
export interface TutorProfileFiles {
  /** JPEG, PNG, WebP or GIF, max 10 MB. */
  profilePicture?: File;
}

/**
 * The backend's regex rules, converted to JavaScript.
 * Java's \p{L} (any letter) needs the `u` flag in JS.
 * Use with Validators.pattern(...) in the form.
 */
export const TUTOR_PROFILE_PATTERNS = {
  name: /^[\p{L}][\p{L}\p{M} '.-]*$/u,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  currency: /^[A-Za-z]{3}$/,
  linkedinUrl: /^https:\/\/.{3,250}$/,
  websiteUrl: /^https?:\/\/.{3,250}$/,
} as const;

/** An item of GET /tutor-profile and /search. Mirrors TutorProfileSummaryResponseDto. */
export interface TutorProfileSummary {
  id: string;
  profilePictureUrl?: string;
  title?: string;
  firstName: string;
  lastName: string;
  email?: string;
  tutorNumber?: string;
  faculty?: string;
  department?: string;
  fieldOfSpecialization?: string;
  yearsOfExperience?: number;
  hourlyRate?: number;
  currency?: string;
  status?: TutorStatus;
  createdAt?: string;
}

export type TutorProfileSortField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'tutorNumber'
  | 'yearsOfExperience'
  | 'joinedDate'
  | 'createdAt'
  | 'updatedAt';

/** Query of GET /tutor-profile/search and /download. Mirrors TutorProfilePagedQueryDto. */
export interface TutorProfileSearchQuery {
  /** Matches full name, email or tutor number. Max 100 characters. */
  search?: string;
  /** Exact match, case-insensitive. Max 150 characters each. */
  faculty?: string;
  department?: string;
  fieldOfSpecialization?: string;
  /** Tutors who teach this subject (exact match, case-insensitive). */
  subject?: string;
  /** 0–60. */
  minYearsOfExperience?: number;
  status?: TutorStatus;
  /** "YYYY-MM-DD" */
  joinedFrom?: string;
  joinedTo?: string;
  page?: number;
  /** 1–100. Ignored by /download. */
  size?: number;
  sortBy?: TutorProfileSortField;
  sortDirection?: 'asc' | 'desc';
}
