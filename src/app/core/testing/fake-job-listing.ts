import {
  EmploymentType,
  ExperienceLevel,
  JobListingPageResponseDto,
  JobListingResponseDto,
  JobListingSummaryResponseDto,
  JobStatus,
  SalaryPeriod,
  WorkMode,
} from '../../features/job-listing/job-listing.model';

export function fakeJobListing(
  overrides: Partial<JobListingResponseDto> = {},
): JobListingResponseDto {
  return {
    id: 'job-1',
    title: 'Lecturer in Mathematics',
    slug: 'lecturer-in-mathematics',
    referenceCode: 'JOB-2026-0042',
    shortDescription: 'Teach first-year calculus and algebra.',
    description: 'Join our maths department.',
    responsibilities: 'Teach and mark.',
    requirements: "A master's degree in mathematics.",
    faculty: 'Science',
    department: 'Mathematics',
    employmentType: EmploymentType.FULL_TIME,
    workMode: WorkMode.HYBRID,
    experienceLevel: ExperienceLevel.MID,
    minimumYearsExperience: 3,
    numberOfVacancies: 2,
    city: 'Douala',
    country: 'Cameroon',
    skills: ['Calculus', 'Algebra'],
    benefits: ['Health insurance'],
    salaryMin: 250000,
    salaryMax: 400000,
    currency: 'XAF',
    salaryPeriod: SalaryPeriod.MONTHLY,
    salaryVisible: true,
    applicationDeadline: '2099-12-31',
    contactEmail: 'careers@example.org',
    status: JobStatus.OPEN,
    publishedAt: '2026-11-20T09:00:00Z',
    createdAt: '2026-11-19T09:00:00Z',
    updatedAt: '2026-11-20T09:00:00Z',
    ...overrides,
  };
}

export function fakeJobSummary(
  overrides: Partial<JobListingSummaryResponseDto> = {},
): JobListingSummaryResponseDto {
  const { description: _d, ...job } = fakeJobListing();
  return { ...job, ...overrides };
}

export function jobPage(content: JobListingSummaryResponseDto[], totalElements = content.length) {
  const data: JobListingPageResponseDto = {
    content,
    pageNumber: 0,
    pageSize: 20,
    numberOfElements: content.length,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / 20)),
    first: true,
    last: totalElements <= 20,
    hasNext: totalElements > 20,
    hasPrevious: false,
  };
  return { success: true, status: 200, message: 'OK', data, path: '', timestamp: '' };
}
