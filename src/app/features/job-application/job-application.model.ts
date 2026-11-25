import { SalaryPeriod } from '../job-listing/job-listing.model';

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

export interface CreateJobApplicationRequestDto {
  jobListingId: string;
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
  consentGiven: boolean;
}

export interface JobApplicationFiles {
  cv: File;
  profilePic?: File | null;
  supportingDocuments?: File[];
}

export interface JobApplicationResponseDto {
  id: string;
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
  uploadCV?: string;
  supportingDocuments: string[];
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

export interface JobApplicationQueryDto {
  jobListingId?: string;
  status?: ApplicationStatus;
  keyword?: string;
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  size?: number;
  sortBy?: JobApplicationSortBy;
  sortDirection?: 'asc' | 'desc';
}

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
