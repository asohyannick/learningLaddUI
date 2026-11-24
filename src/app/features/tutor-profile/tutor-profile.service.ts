import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CreateTutorProfileRequest,
  TutorProfileFiles,
  TutorProfileResponse,
  TutorProfileSearchQuery,
  TutorProfileSummary,
  UpdateTutorProfileRequest,
} from './tutor-profile.model';

/**
 * Tutor profile API (`/tutor-profile`). Reading, searching, counting and exporting are for staff
 * and students; lecturers, professors and assistant lecturers create their own profile and may
 * update or delete it. Admins may update or delete any profile.
 */
@Injectable({ providedIn: 'root' })
export class TutorProfileService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tutor-profile`;

  /** `GET /tutor-profile`: every profile, newest first. */
  listProfiles(page = 0, size = 20): Observable<PageResponse<TutorProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<TutorProfileSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  /** `GET /tutor-profile/search`: keyword, filters, sort and paging. */
  searchProfiles(query: TutorProfileSearchQuery): Observable<PageResponse<TutorProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<TutorProfileSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  /** `GET /tutor-profile/count` */
  countProfiles(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  /** `GET /tutor-profile/{id}` */
  getProfile(id: string): Observable<TutorProfileResponse> {
    return this.http
      .get<ApiResponse<TutorProfileResponse>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * `POST /tutor-profile` (multipart, tutors only). The API requires an `Idempotency-Key`
   * (8–100 characters); reuse it when retrying so only one profile is created.
   */
  createProfile(
    data: CreateTutorProfileRequest,
    files: TutorProfileFiles,
    idempotencyKey: string,
  ): Observable<ApiResponse<TutorProfileResponse>> {
    return this.http.post<ApiResponse<TutorProfileResponse>>(this.api, toMultipart(data, files), {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  /** `PATCH /tutor-profile/{id}` (multipart). Owner or admin. A new picture replaces the old one. */
  updateProfile(
    id: string,
    data: UpdateTutorProfileRequest,
    files: TutorProfileFiles = {},
  ): Observable<ApiResponse<TutorProfileResponse>> {
    return this.http.patch<ApiResponse<TutorProfileResponse>>(
      `${this.api}/${id}`,
      toMultipart(data, files),
    );
  }

  /** `DELETE /tutor-profile/{id}`. Owner or admin. Emits the API message. */
  deleteProfile(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  /**
   * `GET /tutor-profile/download`: a PDF of every profile matching the filters
   * (page and size are ignored, at most 5,000 rows). Emits the saved file name.
   */
  downloadProfilesPdf(query: TutorProfileSearchQuery = {}): Observable<string> {
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
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'tutor-profiles.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /**
   * PDF of one profile. The API only exports by filter, so this searches by the most specific
   * value it has: email, then tutor number, then full name.
   */
  downloadProfilePdf(
    profile: Pick<TutorProfileSummary, 'email' | 'tutorNumber' | 'firstName' | 'lastName'>,
  ): Observable<string> {
    const search =
      profile.email || profile.tutorNumber || `${profile.firstName} ${profile.lastName}`;
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
function toMultipart(data: UpdateTutorProfileRequest, files: TutorProfileFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.profilePicture) body.append('profilePicture', files.profilePicture);
  return body;
}

/** "Dr. Chidi Eze", or "Chidi Eze" without a title. */
export function tutorName(
  profile: Pick<TutorProfileSummary, 'title' | 'firstName' | 'lastName'>,
): string {
  return [profile.title, profile.firstName, profile.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

export function tutorInitials(
  profile: Pick<TutorProfileSummary, 'firstName' | 'lastName'>,
): string {
  return `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

/** "25.00 XAF / hour", or null when no rate is set. */
export function hourlyRateLabel(
  profile: Pick<TutorProfileSummary, 'hourlyRate' | 'currency'>,
): string | null {
  if (profile.hourlyRate === undefined || profile.hourlyRate === null) return null;
  const amount = Number(profile.hourlyRate).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${profile.currency?.toUpperCase() ?? ''}`.trim() + ' / hour';
}
