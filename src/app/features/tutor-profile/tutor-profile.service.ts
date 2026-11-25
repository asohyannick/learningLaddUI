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

@Injectable({ providedIn: 'root' })
export class TutorProfileService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tutor-profile`;

  listProfiles(page = 0, size = 20): Observable<PageResponse<TutorProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<TutorProfileSummary>>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchProfiles(query: TutorProfileSearchQuery): Observable<PageResponse<TutorProfileSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<TutorProfileSummary>>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  countProfiles(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getProfile(id: string): Observable<TutorProfileResponse> {
    return this.http
      .get<ApiResponse<TutorProfileResponse>>(`${this.api}/${id}`)
      .pipe(map((res) => res.data));
  }

  createProfile(
    data: CreateTutorProfileRequest,
    files: TutorProfileFiles,
    idempotencyKey: string,
  ): Observable<ApiResponse<TutorProfileResponse>> {
    return this.http.post<ApiResponse<TutorProfileResponse>>(this.api, toMultipart(data, files), {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

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

  deleteProfile(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

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

function toMultipart(data: UpdateTutorProfileRequest, files: TutorProfileFiles): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.profilePicture) body.append('profilePicture', files.profilePicture);
  return body;
}

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
