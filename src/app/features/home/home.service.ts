import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, CourseSummary, PageResponse, PartnerPublic } from '../../core/interface';

/** API calls made by the landing page. */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** Newest courses. Requires a signed-in user (the API returns 401 otherwise). */
  getFeaturedCourses(size = 3): Observable<CourseSummary[]> {
    return this.http
      .get<ApiResponse<PageResponse<CourseSummary>>>(`${this.api}/course`, {
        params: { page: 0, size },
      })
      .pipe(map((res) => res.data.content));
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
