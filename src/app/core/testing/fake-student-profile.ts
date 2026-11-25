import {
  StudentProfileResponse,
  StudentProfileSummary,
} from '../../features/student-profile/student-profile.model';

export function fakeStudentSummary(
  overrides: Partial<StudentProfileSummary> = {},
): StudentProfileSummary {
  return {
    id: 'sp-1',
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara@example.com',
    studentNumber: 'LL-2026-0001',
    faculty: 'Science',
    department: 'Computer Science',
    programOfStudy: 'BSc Software Engineering',
    currentLevel: 2,
    enrollmentStatus: 'ACTIVE',
    createdAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function fakeStudentProfile(
  overrides: Partial<StudentProfileResponse> = {},
): StudentProfileResponse {
  return {
    id: 'sp-1',
    userId: 'fbdf6d54-e471-448d-87b1-262416f9e3a5',
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara@example.com',
    phoneNumber: '+237670000000',
    city: 'Douala',
    country: 'Cameroon',
    studentNumber: 'LL-2026-0001',
    faculty: 'Science',
    department: 'Computer Science',
    programOfStudy: 'BSc Software Engineering',
    currentLevel: 2,
    enrollmentStatus: 'ACTIVE',
    hobbies: ['Chess', 'Football'],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}
