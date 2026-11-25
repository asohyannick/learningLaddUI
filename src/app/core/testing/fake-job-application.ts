import {
  ApplicationStatus,
  JobApplicationPageResponseDto,
  JobApplicationResponseDto,
} from '../../features/job-application/job-application.model';
import { SalaryPeriod } from '../../features/job-listing/job-listing.model';

export function fakeJobApplication(
  overrides: Partial<JobApplicationResponseDto> = {},
): JobApplicationResponseDto {
  return {
    id: 'app-1',
    profilePic: 'https://files.example.org/pic.png',
    jobListingId: 'job-1',
    applicantId: 'me',
    firstName: 'Amara',
    lastName: 'Ndip',
    email: 'amara@example.com',
    phoneNumber: '+237 670 000 000',
    city: 'Douala',
    country: 'Cameroon',
    currentJobTitle: 'Teaching assistant',
    yearsOfExperience: 4,
    expectedSalary: 300000,
    expectedSalaryCurrency: 'XAF',
    expectedSalaryPeriod: SalaryPeriod.MONTHLY,
    coverLetter: 'I love teaching maths.',
    uploadCV: 'https://files.example.org/cv.pdf',
    supportingDocuments: ['doc-1'],
    supportingDocumentUrls: ['https://files.example.org/doc-1.pdf'],
    status: ApplicationStatus.SUBMITTED,
    submittedAt: '2026-11-22T10:00:00Z',
    consentGiven: true,
    createdAt: '2026-11-22T10:00:00Z',
    updatedAt: '2026-11-22T10:00:00Z',
    ...overrides,
  };
}

export function applicationPage(
  content: JobApplicationResponseDto[],
  totalElements = content.length,
) {
  const data: JobApplicationPageResponseDto = {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / 20)),
    first: true,
    last: totalElements <= 20,
  };
  return { success: true, status: 200, message: 'OK', data, path: '', timestamp: '' };
}
