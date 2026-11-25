export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ALL_LEVELS';

export type CourseStatus = 'PAID' | 'FREE' | 'COMPLETED' | 'UNCOMPLETED';

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
  discount: number;
  currency: string;
  status: CourseStatus | null;
  published: boolean;
  thumbnailUrl: string | null;
  promoVideoUrl: string | null;
  createdAt: string;
}
