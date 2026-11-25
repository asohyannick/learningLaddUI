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

export enum JobStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  ON_HOLD = 'ON_HOLD',
  CLOSED = 'CLOSED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

export type UUID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface CreateJobListingRequestDto {
  title: string;
  jobPhotoUrl?: string;
  shortDescription?: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  faculty?: string;
  department?: string;
  positionTitle?: string;
  reportsTo?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  minimumYearsExperience?: number;
  minimumEducation?: string;
  numberOfVacancies?: number;
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
  salaryVisible?: boolean;
  applicationDeadline?: ISODate;
  expectedStartDate?: ISODate;
  contactEmail?: string;
  applicationInstructions?: string;
}

export interface UpdateJobListingRequestDto {
  title?: string;
  jobPhotoUrl?: string;
  shortDescription?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  faculty?: string;
  department?: string;
  positionTitle?: string;
  reportsTo?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  minimumYearsExperience?: number;
  minimumEducation?: string;
  numberOfVacancies?: number;
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
  salaryVisible?: boolean;
  applicationDeadline?: ISODate;
  expectedStartDate?: ISODate;
  contactEmail?: string;
  applicationInstructions?: string;
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

export type JobListingSortDirection = 'asc' | 'desc';

export interface JobListingPagedQueryDto {
  search?: string;
  faculty?: string;
  department?: string;
  city?: string;
  country?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experienceLevel?: ExperienceLevel;
  status?: JobStatus;
  openOnly?: boolean;
  minSalary?: number;
  maxSalary?: number;
  deadlineFrom?: ISODate;
  deadlineTo?: ISODate;
  page?: number;
  size?: number;
  sortBy?: JobListingSortBy;
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
  title: string;
  slug: string;
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

export interface JobListingPdfDto {
  fileName: string;
  content: string;
}

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

export const CLOSED_JOB_STATUSES: readonly JobStatus[] = [
  JobStatus.CLOSED,
  JobStatus.FILLED,
  JobStatus.CANCELLED,
];

export const JOB_LISTING_MAX_EXPORT_ROWS = 200;

export const JOB_LISTING_PATTERNS = {
  photoUrl: /^https?:\/\/\S{3,1020}$/,
  currency: /^[A-Z]{3}$/,
} as const;

export const JOB_LIST_LIMITS = {
  skills: [30, 100],
  certifications: [20, 150],
  languages: [10, 50],
  benefits: [20, 150],
} as const;

export type JobListField = keyof typeof JOB_LIST_LIMITS;

export type ApplicationStatus = string;

export interface CreateJobApplicationRequestDto {
  jobListingId: UUID;
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
  consentGiven: true;
}

export interface UpdateJobApplicationRequestDto {
  profilePic?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
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
  supportingDocuments?: string[];
}

export type JobApplicationSortBy =
  'createdAt' | 'submittedAt' | 'updatedAt' | 'status' | 'lastName' | 'yearsOfExperience';

export type JobApplicationSortDirection = 'ASC' | 'DESC';

export interface PagedQueryApplicationRequestDto {
  jobListingId?: UUID;
  status?: ApplicationStatus;
  keyword?: string;
  submittedFrom?: ISODateTime;
  submittedTo?: ISODateTime;
  page?: number;
  size?: number;
  sortBy?: JobApplicationSortBy;
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

export interface JobApplicationResponseDto {
  id: UUID;

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
  uploadCV?: string;
  supportingDocuments: string[];
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

export const applicantFullName = (
  a: Pick<JobApplicationResponseDto, 'firstName' | 'lastName'>,
): string => `${a.firstName ?? ''} ${a.lastName ?? ''}`;
