import { SalaryPeriod } from '../job-listing/job-listing.model';

// Mirrors the backend's CreateJobApplicationRequestDto and JobApplicationResponseDto.

export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFERED = 'OFFERED',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/** Sent as the JSON `data` part of `POST /job-application`. */
export interface CreateJobApplicationRequestDto {
  jobListingId: string;
  /** Required, max 100 */
  firstName: string;
  /** Required, max 100 */
  lastName: string;
  /** Required, valid email, max 255 */
  email: string;
  /** `^\+?[0-9 ()-]{7,30}$` */
  phoneNumber?: string;
  /** In the past */
  dateOfBirth?: string;
  nationality?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  currentJobTitle?: string;
  currentEmployer?: string;
  /** 0–60 */
  yearsOfExperience?: number;
  highestEducation?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  /** ≥ 0, 10 digits and 2 decimals */
  expectedSalary?: number;
  /** 3-letter code; USD by default */
  expectedSalaryCurrency?: string;
  /** MONTHLY by default */
  expectedSalaryPeriod?: SalaryPeriod;
  /** Today or later */
  availableFrom?: string;
  /** 0–365 */
  noticePeriodDays?: number;
  /** Max 10,000 */
  coverLetter?: string;
  /** Must be true */
  consentGiven: boolean;
}

/** Files sent next to the `data` part. The CV is required by the API. */
export interface JobApplicationFiles {
  cv: File;
  profilePic?: File | null;
  supportingDocuments?: File[];
}

/** `@JsonInclude(NON_NULL)`: empty fields are left out. Links are valid for about an hour. */
export interface JobApplicationResponseDto {
  id: string;
  /** Signed link to the photo (or the default picture). */
  profilePic?: string;
  jobListingId: string;
  applicantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
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
  availableFrom?: string;
  noticePeriodDays?: number;
  coverLetter?: string;
  /** Signed link to the CV. */
  uploadCV?: string;
  /** IDs of the stored supporting documents. */
  supportingDocuments: string[];
  /** Signed links to the supporting documents, in the same order. */
  supportingDocumentUrls: string[];
  status: ApplicationStatus;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  rejectionReason?: string;
  interviewScheduledAt?: string;
  withdrawnAt?: string;
  consentGiven: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** `JobApplicationPageResponseDto` (inside the usual `{ success, data }` envelope). */
export interface JobApplicationPageResponseDto {
  content: JobApplicationResponseDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export type JobApplicationSortBy =
  'createdAt' | 'submittedAt' | 'updatedAt' | 'status' | 'lastName' | 'yearsOfExperience';

/** Query parameters of `/job-application/search` and `/download`. */
export interface JobApplicationQueryDto {
  jobListingId?: string;
  status?: ApplicationStatus;
  /** Matches first name, last name or email. Max 100. */
  keyword?: string;
  /** ISO instant, e.g. 2026-11-01T00:00:00Z. Not after submittedTo. */
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  /** 1–100 */
  size?: number;
  sortBy?: JobApplicationSortBy;
  sortDirection?: 'asc' | 'desc';
}

/**
 * `data` part of `PATCH /job-application/{id}`: only the applicant, only while SUBMITTED.
 * Omitted fields are kept. `supportingDocuments` lists the IDs to keep ([] removes all).
 */
export type UpdateJobApplicationRequestDto = Partial<
  Omit<CreateJobApplicationRequestDto, 'jobListingId' | 'consentGiven'>
> & { supportingDocuments?: string[] };

export const APPLICATION_STATUSES = Object.values(ApplicationStatus);

export const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORTING_DOC_TYPES = [...CV_TYPES, 'image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTING_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_SUPPORTING_DOCS = 5;
export const PROFILE_PIC_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PROFILE_PIC_MAX_BYTES = 5 * 1024 * 1024;
export const APPLICATION_PHONE_PATTERN = /^\+?[0-9 ()-]{7,30}$/;
