// Course DTOs shared by several features (home, course, shopping cart...). Match the Swagger schemas.

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';

export type CourseStatus = 'PAID' | 'FREE' | 'COMPLETED' | 'UNCOMPLETED';

/** One item of `GET /course` (`CourseSummaryResponseDto`). */
export interface CourseSummary {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  category: string | null;
  level: CourseLevel | null;
  language: string | null;
  durationMinutes: number | null;
  price: number;
  /** An amount in the same currency as `price`, not a percentage. */
  discount: number;
  /** ISO 4217 code, e.g. `USD`. */
  currency: string;
  status: CourseStatus | null;
  published: boolean;
  thumbnailUrl: string | null;
  promoVideoUrl: string | null;
  createdAt: string;
}
