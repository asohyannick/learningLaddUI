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
  id: string; // UUID
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
  createdBy?: string; // UUID of the creating user
  createdAt?: string; // ISO-8601 instant
  updatedAt?: string; // ISO-8601 instant
}

/** `PATCH /course/{id}`: send only what changes; omitted fields keep their value. */
export type UpdateCourseRequest = Partial<CreateCourseRequest>;

/** Optional files sent with a create or update. A new file replaces the current one. */
export interface CourseFiles {
  thumbnail?: File | null;
  promoVideo?: File | null;
  syllabus?: File | null;
  /** Added to the course's existing materials. */
  materials?: readonly File[];
}

export type CourseSortField =
  'name' | 'price' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'durationMinutes';

/** Query of `GET /course/search` (`CoursePagedQueryDto`). Empty values are not sent. */
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
  /** 1–100. */
  size?: number;
  sortBy?: CourseSortField;
  sortDirection?: 'asc' | 'desc';
}
