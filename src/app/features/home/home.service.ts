import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, CourseSummary, PageResponse, PartnerPublic } from '../../core/interface';
import { CourseService } from '../course/course.service';

/** API calls made by the landing page. */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly http = inject(HttpClient);
  private readonly courses = inject(CourseService);
  private readonly api = environment.apiUrl;

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

  /** Partners shown on the website, featured first. Public: no login required. */
  getPartners(size = 5): Observable<PartnerPublic[]> {
    return this.http
      .get<ApiResponse<PageResponse<PartnerPublic>>>(`${this.api}/partners/public`, {
        params: { page: 0, size },
      })
      .pipe(map((res) => res.data.content));
  }
}
