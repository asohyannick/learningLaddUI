import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CourseSummary, PageResponse } from '../../core/interface';
import { CourseService } from '../course/course.service';

@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly courses = inject(CourseService);

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
