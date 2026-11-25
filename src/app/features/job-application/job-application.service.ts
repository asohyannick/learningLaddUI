import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  ApplicationStatus,
  CreateJobApplicationRequestDto,
  JobApplicationFiles,
  JobApplicationPageResponseDto,
  JobApplicationQueryDto,
  JobApplicationResponseDto,
  UpdateJobApplicationRequestDto,
} from './job-application.model';

@Injectable({ providedIn: 'root' })
export class JobApplicationService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/job-application`;

  submitApplication(
    data: CreateJobApplicationRequestDto,
    files: JobApplicationFiles,
    idempotencyKey: string,
  ): Observable<ApiResponse<JobApplicationResponseDto>> {
    const body = toMultipart(data, files);
    return this.http.post<ApiResponse<JobApplicationResponseDto>>(this.api, body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  listApplications(page = 0, size = 20): Observable<JobApplicationPageResponseDto> {
    return this.http
      .get<ApiResponse<JobApplicationPageResponseDto>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchApplications(query: JobApplicationQueryDto): Observable<JobApplicationPageResponseDto> {
    return this.http
      .get<ApiResponse<JobApplicationPageResponseDto>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  countApplications(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getApplication(id: string): Observable<JobApplicationResponseDto> {
    return this.http
      .get<ApiResponse<JobApplicationResponseDto>>(`${this.api}/${encodeURIComponent(id)}`)
      .pipe(map((res) => res.data));
  }

  updateApplication(
    id: string,
    data: UpdateJobApplicationRequestDto,
    files: Partial<JobApplicationFiles> = {},
  ): Observable<ApiResponse<JobApplicationResponseDto>> {
    return this.http.patch<ApiResponse<JobApplicationResponseDto>>(
      `${this.api}/${id}`,
      toMultipart(data, files),
    );
  }

  deleteApplication(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  downloadApplicationsPdf(query: JobApplicationQueryDto = {}): Observable<string> {
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
            'job-applications.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  downloadApplicationPdf(
    application: Pick<JobApplicationResponseDto, 'email' | 'jobListingId'>,
  ): Observable<string> {
    return this.downloadApplicationsPdf({
      keyword: application.email.slice(0, 100),
      jobListingId: application.jobListingId,
    });
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

function toMultipart(data: object, files: Partial<JobApplicationFiles>): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (files.cv) body.append('cv', files.cv);
  if (files.profilePic) body.append('profilePic', files.profilePic);
  for (const doc of files.supportingDocuments ?? []) body.append('supportingDocuments', doc);
  return body;
}

export function applicantName(
  a: Pick<JobApplicationResponseDto, 'firstName' | 'lastName'>,
): string {
  return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
}

export function applicantInitials(
  a: Pick<JobApplicationResponseDto, 'firstName' | 'lastName'>,
): string {
  return `${a.firstName?.[0] ?? ''}${a.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function canEditApplication(a: Pick<JobApplicationResponseDto, 'status'>): boolean {
  return a.status === ApplicationStatus.SUBMITTED;
}

export function applicationStatusClasses(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return 'bg-sky-400/10 text-sky-300 ring-sky-400/30';
    case ApplicationStatus.UNDER_REVIEW:
    case ApplicationStatus.INTERVIEW_SCHEDULED:
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/30';
    case ApplicationStatus.SHORTLISTED:
    case ApplicationStatus.OFFERED:
      return 'bg-violet-400/10 text-violet-300 ring-violet-400/30';
    case ApplicationStatus.HIRED:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    default:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
  }
}

export function applicationStatusClassesLight(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case ApplicationStatus.UNDER_REVIEW:
    case ApplicationStatus.INTERVIEW_SCHEDULED:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case ApplicationStatus.SHORTLISTED:
    case ApplicationStatus.OFFERED:
      return 'bg-violet-50 text-violet-700 ring-violet-200';
    case ApplicationStatus.HIRED:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    default:
      return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
}

export function shortDate(value?: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

const PERIODS: Record<string, string> = {
  HOURLY: 'hour',
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

export function applicationFacts(a: JobApplicationResponseDto): { label: string; value: string }[] {
  const salary =
    a.expectedSalary === undefined || a.expectedSalary === null
      ? ''
      : `${a.expectedSalaryCurrency ?? 'USD'} ${Number(a.expectedSalary).toLocaleString('en-US')}${
          a.expectedSalaryPeriod ? ` / ${PERIODS[a.expectedSalaryPeriod]}` : ''
        }`;
  return [
    { label: 'Email', value: a.email },
    { label: 'Phone', value: a.phoneNumber ?? '' },
    { label: 'Location', value: [a.city, a.stateRegion, a.country].filter(Boolean).join(', ') },
    { label: 'Nationality', value: a.nationality ?? '' },
    { label: 'Born', value: shortDate(a.dateOfBirth) },
    {
      label: 'Current role',
      value: [a.currentJobTitle, a.currentEmployer].filter(Boolean).join(' at '),
    },
    {
      label: 'Experience',
      value:
        a.yearsOfExperience === undefined || a.yearsOfExperience === null
          ? ''
          : `${a.yearsOfExperience} year${a.yearsOfExperience === 1 ? '' : 's'}`,
    },
    { label: 'Education', value: a.highestEducation ?? '' },
    { label: 'Expected salary', value: salary },
    { label: 'Available from', value: shortDate(a.availableFrom) },
    {
      label: 'Notice period',
      value:
        a.noticePeriodDays === undefined || a.noticePeriodDays === null
          ? ''
          : `${a.noticePeriodDays} day${a.noticePeriodDays === 1 ? '' : 's'}`,
    },
    { label: 'Submitted', value: shortDate(a.submittedAt ?? a.createdAt) },
  ].filter((f) => f.value);
}
