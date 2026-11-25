import {
  TutorProfileResponse,
  TutorProfileSummary,
} from '../../features/tutor-profile/tutor-profile.model';

export function fakeTutorSummary(
  overrides: Partial<TutorProfileSummary> = {},
): TutorProfileSummary {
  return {
    id: 'tp-1',
    title: 'Dr.',
    firstName: 'Chidi',
    lastName: 'Eze',
    email: 'chidi@example.com',
    tutorNumber: 'TUT-2026-0001',
    faculty: 'Science',
    department: 'Mathematics',
    fieldOfSpecialization: 'Applied Mathematics',
    yearsOfExperience: 8,
    hourlyRate: 25,
    currency: 'USD',
    status: 'ACTIVE',
    createdAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function fakeTutorProfile(
  overrides: Partial<TutorProfileResponse> = {},
): TutorProfileResponse {
  return {
    id: 'tp-1',
    userId: 'fbdf6d54-e471-448d-87b1-262416f9e3a5',
    title: 'Dr.',
    firstName: 'Chidi',
    lastName: 'Eze',
    email: 'chidi@example.com',
    phoneNumber: '+237670000000',
    city: 'Douala',
    country: 'Cameroon',
    tutorNumber: 'TUT-2026-0001',
    faculty: 'Science',
    department: 'Mathematics',
    highestQualification: 'PhD Mathematics',
    fieldOfSpecialization: 'Applied Mathematics',
    subjects: ['Calculus', 'Linear Algebra'],
    languages: ['English', 'French'],
    yearsOfExperience: 8,
    hourlyRate: 25,
    currency: 'USD',
    status: 'ACTIVE',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}
