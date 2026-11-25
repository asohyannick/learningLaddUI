import { EnrollmentStatus, Gender } from '../../core/enum/global-enum-configuration';

export type { EnrollmentStatus };

export interface CreateStudentProfileRequest {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];

  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number;

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  linkedinUrl?: string;
  websiteUrl?: string;
}

export interface StudentProfileResponse {
  id: string;
  userId: string;
  profilePictureUrl?: string;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];

  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  studentNumber?: string;
  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number;
  enrollmentStatus?: EnrollmentStatus;
  admissionDate?: string;
  expectedGraduationDate?: string;
  gpa?: number;

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  linkedinUrl?: string;
  websiteUrl?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface StudentProfileFiles {
  profilePicture?: File;
}

export const STUDENT_PROFILE_PATTERNS = {
  name: /^[\p{L}][\p{L}\p{M} '.-]*$/u,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  linkedinUrl: /^https:\/\/.{3,250}$/,
  websiteUrl: /^https?:\/\/.{3,250}$/,
} as const;

export type UpdateStudentProfileRequest = Partial<CreateStudentProfileRequest>;

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

export interface StudentProfileSearchQuery {
  search?: string;
  faculty?: string;
  department?: string;
  programOfStudy?: string;
  currentLevel?: number;
  enrollmentStatus?: EnrollmentStatus;
  admittedFrom?: string;
  admittedTo?: string;
  page?: number;
  size?: number;
  sortBy?: StudentProfileSortField;
  sortDirection?: 'asc' | 'desc';
}
