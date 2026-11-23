import { CourseSummary } from '../interface';
import { CourseResponse } from '../../features/course/course.model';

/** Test data shaped like an item of `GET /course`. */
export function fakeCourseSummary(overrides: Partial<CourseSummary> = {}): CourseSummary {
  return {
    id: 'c-1',
    name: 'Data Science 101',
    slug: 'data-science-101',
    shortDescription: 'Learn the basics of data.',
    category: 'Technology',
    level: 'BEGINNER',
    language: 'English',
    durationMinutes: 90,
    price: 50,
    discount: 10,
    currency: 'USD',
    status: 'PAID',
    published: true,
    thumbnailUrl: null,
    promoVideoUrl: null,
    createdAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

/** Test data shaped like `GET /course/{id}`. */
export function fakeCourse(overrides: Partial<CourseResponse> = {}): CourseResponse {
  return {
    id: 'c-1',
    name: 'Data Science 101',
    slug: 'data-science-101',
    shortDescription: 'Learn the basics of data.',
    description: 'A long description.',
    category: 'Technology',
    level: 'BEGINNER',
    language: 'English',
    durationMinutes: 90,
    price: 50,
    discount: 10,
    currency: 'USD',
    status: 'PAID',
    published: true,
    materials: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

/** A course `PagedResponseDto` around `content`. */
export function coursePage<T>(content: T[], totalElements = content.length) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / 20)),
    first: true,
    last: true,
  };
}
