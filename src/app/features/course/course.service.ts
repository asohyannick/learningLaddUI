import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, CourseSummary, PageResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CourseFiles,
  CourseResponse,
  CourseSearchQuery,
  CreateCourseRequest,
  UpdateCourseRequest,
} from './course.model';

/** Course API (`/course`). Reads need a signed-in user; writes need a course role. */
@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/course`;

  /** `GET /course`: every course, newest first. */
  listCourses(page = 0, size = 20): Observable<PageResponse<CourseSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<CourseSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /course/search`: keyword, filters, sort and paging. */
  searchCourses(query: CourseSearchQuery): Observable<PageResponse<CourseSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<CourseSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /course/count`: number of courses, published or not. */
  countCourses(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getCourse(id: string): Observable<CourseResponse> {
    return this.http
      .get<ApiResponse<CourseResponse>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * `POST /course` (multipart). Reuse the same `idempotencyKey` when retrying a failed submit,
   * so the server never creates the course twice.
   */
  createCourse(
    data: CreateCourseRequest,
    files: CourseFiles = {},
    idempotencyKey?: string,
  ): Observable<ApiResponse<CourseResponse>> {
    return this.http.post<ApiResponse<CourseResponse>>(this.api, toMultipart(data, files), {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
  }

  /** `PATCH /course/{id}` (multipart). New files replace the current ones; materials are added. */
  updateCourse(
    id: string,
    data: UpdateCourseRequest,
    files: CourseFiles = {},
  ): Observable<ApiResponse<CourseResponse>> {
    return this.http.patch<ApiResponse<CourseResponse>>(
      `${this.api}/${id}`,
      toMultipart(data, files),
    );
  }

  /** `DELETE /course/{id}`. Emits the API message. */
  deleteCourse(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  /** `GET /course/{id}/pdf`: downloads the course sheet. `fallbackName` is used without a header. */
  downloadCoursePdf(id: string, fallbackName = 'course'): Observable<string> {
    return this.http
      .get(`${this.api}/${id}/pdf`, { observe: 'response', responseType: 'blob' })
      .pipe(
        map((res) => {
          const fileName =
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ??
            `${fallbackName}.pdf`;
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }
}

function toParams(query: CourseSearchQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text !== '') params = params.set(key, text);
  }
  return params;
}

/** The JSON goes in a `data` part with its own content type, files in their named parts. */
function toMultipart(data: UpdateCourseRequest, files: CourseFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.thumbnail) body.append('thumbnail', files.thumbnail);
  if (files.promoVideo) body.append('promoVideo', files.promoVideo);
  if (files.syllabus) body.append('syllabus', files.syllabus);
  for (const file of files.materials ?? []) body.append('materials', file);
  return body;
}

/** Price after the discount (an amount, not a percentage). Never below 0. */
export function finalPrice(course: Pick<CourseSummary, 'price' | 'discount'>): number {
  return Math.max((course.price ?? 0) - (course.discount ?? 0), 0);
}
