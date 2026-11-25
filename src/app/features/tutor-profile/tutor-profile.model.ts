import { Gender, TutorStatus } from '../../core/enum/global-enum-configuration';

export interface CreateTutorProfileRequest {
  firstName: string;
  lastName: string;
  title?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];
  languages?: string[];

  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  faculty?: string;
  department?: string;
  highestQualification?: string;
  fieldOfSpecialization?: string;
  subjects?: string[];
  certifications?: string[];
  yearsOfExperience?: number;

  hourlyRate?: number;
  currency?: string;

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  linkedinUrl?: string;
  websiteUrl?: string;
}

export type UpdateTutorProfileRequest = Partial<CreateTutorProfileRequest>;

export type { TutorStatus };

export interface TutorProfileResponse {
  id: string;
  userId: string;
  profilePictureUrl?: string;
  firstName: string;
  lastName: string;
  email?: string;
  title?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  phoneNumber?: string;
  description?: string;
  hobbies?: string[];
  languages?: string[];

  addressLine?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  country?: string;

  tutorNumber?: string;
  faculty?: string;
  department?: string;
  highestQualification?: string;
  fieldOfSpecialization?: string;
  subjects?: string[];
  certifications?: string[];
  yearsOfExperience?: number;

  hourlyRate?: number;
  currency?: string;

  status?: TutorStatus;
  joinedDate?: string;

  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  linkedinUrl?: string;
  websiteUrl?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface TutorProfileFiles {
  profilePicture?: File;
}

export const TUTOR_PROFILE_PATTERNS = {
  name: /^[\p{L}][\p{L}\p{M} '.-]*$/u,
  phone: /^\+?[0-9 ()-]{7,30}$/,
  currency: /^[A-Za-z]{3}$/,
  linkedinUrl: /^https:\/\/.{3,250}$/,
  websiteUrl: /^https?:\/\/.{3,250}$/,
} as const;

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

export interface TutorProfileSearchQuery {
  search?: string;
  faculty?: string;
  department?: string;
  fieldOfSpecialization?: string;
  subject?: string;
  minYearsOfExperience?: number;
  status?: TutorStatus;
  joinedFrom?: string;
  joinedTo?: string;
  page?: number;
  size?: number;
  sortBy?: TutorProfileSortField;
  sortDirection?: 'asc' | 'desc';
}
