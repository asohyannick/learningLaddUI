import { PageResponse } from '../partnership/partnership.model';

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  TEMPORARY = 'TEMPORARY',
  INTERNSHIP = 'INTERNSHIP',
  VOLUNTEER = 'VOLUNTEER',
}

export enum ExperienceLevel {
  ENTRY = 'ENTRY',
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  EXECUTIVE = 'EXECUTIVE',
}

export enum SalaryPeriod {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum WorkMode {
  ON_SITE = 'ON_SITE',
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
}

/** New listings start as DRAFT; an update with OPEN publishes them. */
export enum JobStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  ON_HOLD = 'ON_HOLD',
  CLOSED = 'CLOSED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

// ─────────────────────────────────────────────────────────────
// Shared scalar aliases (how Jackson serializes the Java types)
// ─────────────────────────────────────────────────────────────

/** java.util.UUID */
export type UUID = string;
/** java.time.LocalDate, ISO date: "2026-12-31" */
export type ISODate = string;
/** java.time.Instant, ISO timestamp: "2026-11-24T13:25:00Z" */
export type ISODateTime = string;

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────
// Rules between fields that the backend checks:
// - salaryMin cannot exceed salaryMax
// - expectedStartDate cannot be before applicationDeadline

export interface CreateJobListingRequestDto {
  /** Required, 3–255 */
  title: string;
  /** Max 1024, must start with http:// or https:// */
  jobPhotoUrl?: string;
  /** Max 500 */
  shortDescription?: string;
  /** Required, max 20000 */
  description: string;
  /** Max 10000 */
  responsibilities?: string;
  /** Max 10000 */
  requirements?: string;
  /** Max 150 */
  faculty?: string;
  /** Max 150 */
  department?: string;
  /** Max 150 */
  positionTitle?: string;
  /** Max 150 */
  reportsTo?: string;
  /** Defaults to FULL_TIME */
  employmentType?: EmploymentType;
  /** Defaults to ON_SITE */
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  /** 0–60 */
  minimumYearsExperience?: number;
  /** Max 100 */
  minimumEducation?: string;
  /** 1–1000. Defaults to 1. */
  numberOfVacancies?: number;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  /** At most 20 items, each non-blank and max 150 */
  certifications?: string[];
  /** At most 30 items, each non-blank and max 100 */
  skills?: string[];
  /** At most 10 items, each non-blank and max 50 */
  languages?: string[];
  /** At most 20 items, each non-blank and max 150 */
  benefits?: string[];
  /** >= 0, at most 10 integer digits and 2 decimals */
  salaryMin?: number;
  /** >= 0, at most 10 integer digits and 2 decimals */
  salaryMax?: number;
  /** 3-letter uppercase ISO 4217 code. Defaults to "USD". */
  currency?: string;
  /** Defaults to MONTHLY */
  salaryPeriod?: SalaryPeriod;
  /** Show the salary range publicly. Defaults to true. */
  salaryVisible?: boolean;
  /** Today or later */
  applicationDeadline?: ISODate;
  expectedStartDate?: ISODate;
  /** Valid email, max 255 */
  contactEmail?: string;
  /** Max 5000 */
  applicationInstructions?: string;
}

/** Partial update: omitted fields are left unchanged. */
export interface UpdateJobListingRequestDto {
  /** 3–255 */
  title?: string;
  /** Max 1024, must start with http:// or https:// */
  jobPhotoUrl?: string;
  /** Max 500 */
  shortDescription?: string;
  /** Max 20000 */
  description?: string;
  /** Max 10000 */
  responsibilities?: string;
  /** Max 10000 */
  requirements?: string;
  /** Max 150 */
  faculty?: string;
  /** Max 150 */
  department?: string;
  /** Max 150 */
  positionTitle?: string;
  /** Max 150 */
  reportsTo?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  /** 0–60 */
  minimumYearsExperience?: number;
  /** Max 100 */
  minimumEducation?: string;
  /** 1–1000 */
  numberOfVacancies?: number;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  /** At most 20 items, each non-blank and max 150 */
  certifications?: string[];
  /** At most 30 items, each non-blank and max 100 */
  skills?: string[];
  /** At most 10 items, each non-blank and max 50 */
  languages?: string[];
  /** At most 20 items, each non-blank and max 150 */
  benefits?: string[];
  /** >= 0, at most 10 integer digits and 2 decimals */
  salaryMin?: number;
  /** >= 0, at most 10 integer digits and 2 decimals */
  salaryMax?: number;
  /** 3-letter uppercase ISO 4217 code */
  currency?: string;
  salaryPeriod?: SalaryPeriod;
  salaryVisible?: boolean;
  /** Today or later */
  applicationDeadline?: ISODate;
  expectedStartDate?: ISODate;
  /** Valid email, max 255 */
  contactEmail?: string;
  /** Max 5000 */
  applicationInstructions?: string;
  /** OPEN publishes the listing; CLOSED, FILLED and CANCELLED close it. */
  status?: JobStatus;
}

export type JobListingSortBy =
  | 'title'
  | 'applicationDeadline'
  | 'publishedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'salaryMin'
  | 'numberOfVacancies';

/** The backend lowercases this, so 'ASC' / 'DESC' also work. */
export type JobListingSortDirection = 'asc' | 'desc';

/** Sent as query parameters. */
export interface JobListingPagedQueryDto {
  /** Max 100. Matched against title, short description, department and reference code. */
  search?: string;
  /** Max 150 */
  faculty?: string;
  /** Max 150 */
  department?: string;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  country?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  status?: JobStatus;
  /** Only listings still accepting applications (OPEN and not past deadline) */
  openOnly?: boolean;
  /** >= 0. Must not be greater than maxSalary. */
  minSalary?: number;
  /** >= 0 */
  maxSalary?: number;
  /** Deadline on or after this date. Must not be after deadlineTo. */
  deadlineFrom?: ISODate;
  /** Deadline on or before this date */
  deadlineTo?: ISODate;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** 1–100. Defaults to 20. */
  size?: number;
  /** Defaults to "createdAt" */
  sortBy?: JobListingSortBy;
  /** Defaults to "desc" */
  sortDirection?: JobListingSortDirection;
}

export const JOB_LISTING_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'createdAt',
  sortDirection: 'desc',
} as const satisfies Required<
  Pick<JobListingPagedQueryDto, 'page' | 'size' | 'sortBy' | 'sortDirection'>
>;

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────
// Both response records use @JsonInclude(NON_NULL), so nullable
// fields are left out of the JSON when null: hence optional here.
// Java primitives (int, boolean) are always present.

export interface JobListingResponseDto {
  id: UUID;
  title: string;
  slug: string;
  referenceCode: string;
  jobPhotoUrl?: string;
  shortDescription?: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  faculty?: string;
  department?: string;
  positionTitle?: string;
  reportsTo?: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  experienceLevel?: ExperienceLevel;
  minimumYearsExperience?: number;
  minimumEducation?: string;
  numberOfVacancies: number;
  city?: string;
  stateRegion?: string;
  country?: string;
  certifications?: string[];
  skills?: string[];
  languages?: string[];
  benefits?: string[];
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  salaryPeriod?: SalaryPeriod;
  salaryVisible: boolean;
  applicationDeadline?: ISODate;
  expectedStartDate?: ISODate;
  contactEmail?: string;
  applicationInstructions?: string;
  status: JobStatus;
  publishedAt?: ISODateTime;
  closedAt?: ISODateTime;
  postedBy?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface JobListingSummaryResponseDto {
  id: UUID;
  /** e.g. "Lecturer in Mathematics" */
  title: string;
  /** e.g. "lecturer-in-mathematics" */
  slug: string;
  /** e.g. "JOB-2026-0042" */
  referenceCode: string;
  jobPhotoUrl?: string;
  shortDescription?: string;
  faculty?: string;
  department?: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  experienceLevel?: ExperienceLevel;
  city?: string;
  country?: string;
  numberOfVacancies: number;
  applicationDeadline?: ISODate;
  status: JobStatus;
  publishedAt?: ISODateTime;
}

/**
 * Only used if the backend returns this record as JSON: Jackson sends
 * byte[] as a Base64 string. If the endpoint streams the PDF directly
 * (Content-Type: application/pdf), fetch it as a Blob instead.
 */
export interface JobListingPdfDto {
  fileName: string;
  /** Base64-encoded PDF bytes */
  content: string;
}
// ─────────────────────────────────────────────────────────────
// Added for the UI
// ─────────────────────────────────────────────────────────────

/** `PagedResponseDto<JobListingSummaryResponseDto>`, inside the usual `{ success, data }` envelope. */
export interface JobListingPageResponseDto {
  content: JobListingSummaryResponseDto[];
  pageNumber: number;
  pageSize: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const EMPLOYMENT_TYPES = Object.values(EmploymentType);
export const EXPERIENCE_LEVELS = Object.values(ExperienceLevel);
export const SALARY_PERIODS = Object.values(SalaryPeriod);
export const WORK_MODES = Object.values(WorkMode);
export const JOB_STATUSES = Object.values(JobStatus);

/** Statuses after which a listing no longer takes applications. */
export const CLOSED_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.CLOSED,
  JobStatus.FILLED,
  JobStatus.CANCELLED,
];

/** The PDF export holds at most this many listings. */
export const JOB_LISTING_MAX_EXPORT_ROWS = 200;

/** Same rules as the backend DTOs. */
export const JOB_LISTING_PATTERNS = {
  photoUrl: /^https?:\/\/\S{3,1020}$/,
  currency: /^[A-Z]{3}$/,
} as const;

/** `[max items, max length of each]` of the list fields. */
export const JOB_LIST_LIMITS = {
  skills: [30, 100],
  certifications: [20, 150],
  languages: [10, 50],
  benefits: [20, 150],
} as const;

export type JobListField = keyof typeof JOB_LIST_LIMITS;

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

/**
 * TODO: the ApplicationStatus Java enum wasn't included, so its values are
 * unknown. Replace this with a string enum like the others once you have it.
 */
export type ApplicationStatus = string;

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────

export interface CreateJobApplicationRequestDto {
  /** Required */
  jobListingId: UUID;
  /** Required, max 100 */
  firstName: string;
  /** Required, max 100 */
  lastName: string;
  /** Required, valid email, max 255. Stored lowercased. */
  email: string;
  /** Max 30, digits, spaces, ( ) - and an optional leading + (7–30 chars) */
  phoneNumber?: string;
  /** Must be in the past */
  dateOfBirth?: ISODate;
  /** Max 100 */
  nationality?: string;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  /** Max 150 */
  currentJobTitle?: string;
  /** Max 150 */
  currentEmployer?: string;
  /** 0–60 */
  yearsOfExperience?: number;
  /** Max 100 */
  highestEducation?: string;
  /** Valid URL, max 500 */
  linkedinUrl?: string;
  /** Valid URL, max 500 */
  portfolioUrl?: string;
  /** >= 0, at most 10 integer digits and 2 decimals */
  expectedSalary?: number;
  /** 3-letter ISO code, uppercased by the backend. Defaults to "USD". */
  expectedSalaryCurrency?: string;
  /** Defaults to MONTHLY */
  expectedSalaryPeriod?: SalaryPeriod;
  /** Today or later */
  availableFrom?: ISODate;
  /** 0–365 */
  noticePeriodDays?: number;
  /** Max 10,000 */
  coverLetter?: string;
  /** Must be true, or the application is rejected */
  consentGiven: true;
}

/** Partial update: omitted fields are left unchanged. */
export interface UpdateJobApplicationRequestDto {
  /** 1–1024 */
  profilePic?: string;
  /** 1–100 */
  firstName?: string;
  /** 1–100 */
  lastName?: string;
  /** Valid email, max 255. Stored lowercased. */
  email?: string;
  /** Max 30, digits, spaces, ( ) - and an optional leading + (7–30 chars) */
  phoneNumber?: string;
  /** Must be in the past */
  dateOfBirth?: ISODate;
  /** Max 100 */
  nationality?: string;
  /** Max 100 */
  city?: string;
  /** Max 100 */
  stateRegion?: string;
  /** Max 100 */
  country?: string;
  /** Max 150 */
  currentJobTitle?: string;
  /** Max 150 */
  currentEmployer?: string;
  /** 0–60 */
  yearsOfExperience?: number;
  /** Max 100 */
  highestEducation?: string;
  /** Valid URL, max 500 */
  linkedinUrl?: string;
  /** Valid URL, max 500 */
  portfolioUrl?: string;
  /** >= 0, at most 10 integer digits and 2 decimals */
  expectedSalary?: number;
  /** 3-letter ISO code, uppercased by the backend */
  expectedSalaryCurrency?: string;
  expectedSalaryPeriod?: SalaryPeriod;
  /** Today or later */
  availableFrom?: ISODate;
  /** 0–365 */
  noticePeriodDays?: number;
  /** Max 10,000 */
  coverLetter?: string;
  /** At most 10, no null entries */
  supportingDocuments?: string[];
}

export type JobApplicationSortBy =
  'createdAt' | 'submittedAt' | 'updatedAt' | 'status' | 'lastName' | 'yearsOfExperience';

/** Case-insensitive on the backend, so 'asc' / 'desc' also work. */
export type JobApplicationSortDirection = 'ASC' | 'DESC';

/** Sent as query parameters. */
export interface PagedQueryApplicationRequestDto {
  jobListingId?: UUID;
  status?: ApplicationStatus;
  /** Max 100 */
  keyword?: string;
  /** ISO timestamp. Must be on or before submittedTo. */
  submittedFrom?: ISODateTime;
  /** ISO timestamp */
  submittedTo?: ISODateTime;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** 1–100. Defaults to 20. */
  size?: number;
  /** Defaults to "submittedAt" */
  sortBy?: JobApplicationSortBy;
  /** Defaults to "DESC" */
  sortDirection?: JobApplicationSortDirection;
}

export const JOB_APPLICATION_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'submittedAt',
  sortDirection: 'DESC',
} as const satisfies Required<
  Pick<PagedQueryApplicationRequestDto, 'page' | 'size' | 'sortBy' | 'sortDirection'>
>;

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────
// @JsonInclude(NON_NULL): nullable fields are left out of the JSON when
// null, hence optional. The two document lists are never null (the record
// replaces null with an empty list), and consentGiven is a primitive.

export interface JobApplicationResponseDto {
  id: UUID;

  /** Profile picture URL */
  profilePic?: string;
  jobListingId: UUID;
  applicantId?: UUID;

  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: ISODate;
  nationality?: string;

  city?: string;
  stateRegion?: string;
  country?: string;

  currentJobTitle?: string;
  currentEmployer?: string;
  yearsOfExperience?: number;
  highestEducation?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;

  expectedSalary?: number;
  expectedSalaryCurrency?: string;
  expectedSalaryPeriod?: SalaryPeriod;
  availableFrom?: ISODate;
  noticePeriodDays?: number;

  coverLetter?: string;
  /** CV URL */
  uploadCV?: string;
  /** Stored document references */
  supportingDocuments: string[];
  /** URLs for the supporting documents */
  supportingDocumentUrls: string[];

  status: ApplicationStatus;
  submittedAt?: ISODateTime;
  reviewedBy?: UUID;
  reviewedAt?: ISODateTime;
  reviewNote?: string;
  rejectionReason?: string;
  interviewScheduledAt?: ISODateTime;
  withdrawnAt?: ISODateTime;
  consentGiven: boolean;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type JobApplicationPageResponseDto = PageResponse<JobApplicationResponseDto>;

/**
 * Client-side equivalent of fullName(). It has no get/is prefix,
 * so Jackson doesn't put it in the JSON.
 */
export const applicantFullName = (
  a: Pick<JobApplicationResponseDto, 'firstName' | 'lastName'>,
): string => `${a.firstName ?? ''} ${a.lastName ?? ''}`;
