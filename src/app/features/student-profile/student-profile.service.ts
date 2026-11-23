import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CreateStudentProfileRequest,
  StudentProfileFiles,
  StudentProfileResponse,
  StudentProfileSearchQuery,
  StudentProfileSummary,
  UpdateStudentProfileRequest,
} from './student-profile.model';

/**
 * Student profile API (`/student-profile`). Reading, searching, counting and exporting are
 * staff-only; a student creates their own profile and may update or delete it.
 */
@Injectable({ providedIn: 'root' })
export class StudentProfileService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/student-profile`;

  /** `GET /student-profile`: every profile, newest first. */
  listProfiles(page = 0, size = 20): Observable<PageResponse<StudentProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<StudentProfileSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /student-profile/search`: keyword, filters, sort and paging. */
  searchProfiles(
    query: StudentProfileSearchQuery,
  ): Observable<PageResponse<StudentProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<StudentProfileSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /student-profile/count` */
  countProfiles(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getProfile(id: string): Observable<StudentProfileResponse> {
    return this.http
      .get<ApiResponse<StudentProfileResponse>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * `POST /student-profile` (multipart, students only). The API requires an `Idempotency-Key`
   * (8–100 characters); reuse it when retrying so only one profile is created.
   */
  createProfile(
    data: CreateStudentProfileRequest,
    files: StudentProfileFiles,
    idempotencyKey: string,
  ): Observable<ApiResponse<StudentProfileResponse>> {
    return this.http.post<ApiResponse<StudentProfileResponse>>(this.api, toMultipart(data, files), {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  /** `PATCH /student-profile/{id}` (multipart). Owner or admin. A new picture replaces the old one. */
  updateProfile(
    id: string,
    data: UpdateStudentProfileRequest,
    files: StudentProfileFiles = {},
  ): Observable<ApiResponse<StudentProfileResponse>> {
    return this.http.patch<ApiResponse<StudentProfileResponse>>(
      `${this.api}/${id}`,
      toMultipart(data, files),
    );
  }

  /** `DELETE /student-profile/{id}`. Owner or admin. Emits the API message. */
  deleteProfile(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  /**
   * `GET /student-profile/download`: a PDF of every profile matching the filters
   * (page and size are ignored, at most 5,000 rows). Emits the saved file name.
   */
  downloadProfilesPdf(query: StudentProfileSearchQuery = {}): Observable<string> {
    const { page: _page, size: _size, ...filters } = query;
    return this.http
      .get(`${this.api}/download`, {
        params: toParams(filters),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => {
          const fileName =
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ??
            'student-profiles.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /**
   * PDF of one profile. The API only exports by filter, so this searches by the most specific
   * value it has: email, then student number, then full name.
   */
  downloadProfilePdf(
    profile: Pick<StudentProfileSummary, 'email' | 'studentNumber' | 'firstName' | 'lastName'>,
  ): Observable<string> {
    const search =
      profile.email || profile.studentNumber || `${profile.firstName} ${profile.lastName}`;
    return this.downloadProfilesPdf({ search: search.slice(0, 100) });
  }
}

function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text !== '') params = params.set(key, text);
  }
  return params;
}

/** JSON in a `data` part with its own content type; the picture in `profilePicture`. */
function toMultipart(data: UpdateStudentProfileRequest, files: StudentProfileFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.profilePicture) body.append('profilePicture', files.profilePicture);
  return body;
}

export function fullName(profile: Pick<StudentProfileSummary, 'firstName' | 'lastName'>): string {
  return `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
}

export function profileInitials(
  profile: Pick<StudentProfileSummary, 'firstName' | 'lastName'>,
): string {
  return `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}
