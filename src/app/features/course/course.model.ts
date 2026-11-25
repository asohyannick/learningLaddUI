import { CourseLevel, CourseStatus } from '../../core/interface';

export interface CreateCourseRequest {
  name: string;
  shortDescription?: string;
  description?: string;

  learningOutcomes?: string;

  requirements?: string;

  category?: string;

  level?: CourseLevel;

  language?: string;

  durationMinutes?: number;

  price?: number;

  discount?: number;

  currency?: string;

  status?: CourseStatus;
  published?: boolean;
}

export interface CourseMaterialResponse {
  id: string;
  description: string;
  sortOrder: number;
  freePreview: boolean;
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface CourseResponse {
  id: string;
  name: string;
  slug: string;
  idempotencyKey?: string;
  shortDescription?: string;
  description?: string;
  learningOutcomes?: string;
  requirements?: string;
  category?: string;
  level?: CourseLevel;
  language?: string;
  durationMinutes?: number;
  price?: number;
  discount?: number;
  currency?: string;
  status?: CourseStatus;
  published: boolean;
  publishedAt?: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;
  syllabusUrl?: string;
  materials?: CourseMaterialResponse[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UpdateCourseRequest = Partial<CreateCourseRequest>;

export interface CourseFiles {
  thumbnail?: File | null;
  promoVideo?: File | null;
  syllabus?: File | null;
  materials?: readonly File[];
}

export type CourseSortField =
  'name' | 'price' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'durationMinutes';

export interface CourseSearchQuery {
  search?: string;
  category?: string;
  level?: CourseLevel;
  status?: CourseStatus;
  language?: string;
  published?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  size?: number;
  sortBy?: CourseSortField;
  sortDirection?: 'asc' | 'desc';
}
