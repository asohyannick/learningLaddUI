import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CourseSummary, PageResponse } from '../../core/interface';
import { CourseService } from '../course/course.service';

/** API calls made by the landing page. */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly courses = inject(CourseService);

  /**
   * Newest published courses (`GET /course/search`); drafts are never shown here.
   * Requires a signed-in user (the API returns 401 otherwise).
   */
  getFeaturedCourses(size = 6): Observable<PageResponse<CourseSummary>> {
    return this.courses.searchCourses({
      published: true,
      page: 0,
      size,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });
  }
}
