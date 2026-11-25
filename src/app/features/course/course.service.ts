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

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/course`;

  listCourses(page = 0, size = 20): Observable<PageResponse<CourseSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<CourseSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchCourses(query: CourseSearchQuery): Observable<PageResponse<CourseSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<CourseSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

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

  createCourse(
    data: CreateCourseRequest,
    files: CourseFiles = {},
    idempotencyKey?: string,
  ): Observable<ApiResponse<CourseResponse>> {
    return this.http.post<ApiResponse<CourseResponse>>(this.api, toMultipart(data, files), {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
  }

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

  deleteCourse(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

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

function toMultipart(data: UpdateCourseRequest, files: CourseFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.thumbnail) body.append('thumbnail', files.thumbnail);
  if (files.promoVideo) body.append('promoVideo', files.promoVideo);
  if (files.syllabus) body.append('syllabus', files.syllabus);
  for (const file of files.materials ?? []) body.append('materials', file);
  return body;
}

export function finalPrice(course: Pick<CourseSummary, 'price' | 'discount'>): number {
  return Math.max((course.price ?? 0) - (course.discount ?? 0), 0);
}
