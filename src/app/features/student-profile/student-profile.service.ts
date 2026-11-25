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

@Injectable({ providedIn: 'root' })
export class StudentProfileService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/student-profile`;

  listProfiles(page = 0, size = 20): Observable<PageResponse<StudentProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<StudentProfileSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchProfiles(
    query: StudentProfileSearchQuery,
  ): Observable<PageResponse<StudentProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<StudentProfileSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

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

  createProfile(
    data: CreateStudentProfileRequest,
    files: StudentProfileFiles,
    idempotencyKey: string,
  ): Observable<ApiResponse<StudentProfileResponse>> {
    return this.http.post<ApiResponse<StudentProfileResponse>>(this.api, toMultipart(data, files), {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

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

  deleteProfile(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

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
