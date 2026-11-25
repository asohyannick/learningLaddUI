import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CLOSED_JOB_STATUSES,
  CreateJobListingRequestDto,
  JobListingPageResponseDto,
  JobListingPagedQueryDto,
  JobListingResponseDto,
  JobListingSummaryResponseDto,
  JobStatus,
  UpdateJobListingRequestDto,
} from './job-listing.model';

@Injectable({ providedIn: 'root' })
export class JobListingService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/job-listing`;

  listJobListings(page = 0, size = 20): Observable<JobListingPageResponseDto> {
    return this.http
      .get<ApiResponse<JobListingPageResponseDto>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchJobListings(query: JobListingPagedQueryDto): Observable<JobListingPageResponseDto> {
    return this.http
      .get<ApiResponse<JobListingPageResponseDto>>(`${this.api}/search`, {
        params: toParams(query),
      })
      .pipe(map((res) => res.data));
  }

  searchOpenJobListings(
    query: Omit<JobListingPagedQueryDto, 'openOnly' | 'status'> = {},
  ): Observable<JobListingPageResponseDto> {
    return this.searchJobListings({
      sortBy: 'publishedAt',
      sortDirection: 'desc',
      ...query,
      openOnly: true,
    });
  }

  countJobListings(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getJobListing(id: string): Observable<JobListingResponseDto> {
    return this.http
      .get<ApiResponse<JobListingResponseDto>>(`${this.api}/${encodeURIComponent(id)}`)
      .pipe(map((res) => res.data));
  }

  createJobListing(
    data: CreateJobListingRequestDto,
    photo?: File | null,
  ): Observable<ApiResponse<JobListingResponseDto>> {
    return this.http.post<ApiResponse<JobListingResponseDto>>(this.api, toMultipart(data, photo));
  }

  updateJobListing(
    id: string,
    data: UpdateJobListingRequestDto,
    photo?: File | null,
  ): Observable<ApiResponse<JobListingResponseDto>> {
    return this.http.patch<ApiResponse<JobListingResponseDto>>(
      `${this.api}/${id}`,
      toMultipart(data, photo),
    );
  }

  deleteJobListing(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  downloadJobListingsPdf(query: JobListingPagedQueryDto = {}): Observable<string> {
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
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'job-listings.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  downloadJobListingPdf(
    listing: Pick<JobListingSummaryResponseDto, 'referenceCode'>,
  ): Observable<string> {
    return this.downloadJobListingsPdf({ search: listing.referenceCode });
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

function toMultipart(data: UpdateJobListingRequestDto, photo?: File | null): FormData {
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (photo) body.append('photo', photo);
  return body;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIODS: Record<string, string> = {
  HOURLY: 'hour',
  DAILY: 'day',
  WEEKLY: 'week',
  MONTHLY: 'month',
  YEARLY: 'year',
};

export function jobDateLabel(value?: string): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function jobLocation(job: {
  city?: string;
  stateRegion?: string;
  country?: string;
}): string {
  return [job.city, job.country].filter(Boolean).join(', ');
}

export function salaryLabel(
  job: Pick<
    JobListingResponseDto,
    'salaryMin' | 'salaryMax' | 'currency' | 'salaryPeriod' | 'salaryVisible'
  >,
): string | null {
  if (!job.salaryVisible) return null;
  const amount = (value?: number) =>
    value === undefined || value === null
      ? null
      : Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const min = amount(job.salaryMin);
  const max = amount(job.salaryMax);
  if (!min && !max) return null;
  const range =
    min && max ? (min === max ? min : `${min} – ${max}`) : min ? `From ${min}` : `Up to ${max}`;
  const period = job.salaryPeriod ? ` / ${PERIODS[job.salaryPeriod] ?? job.salaryPeriod}` : '';
  return `${job.currency ?? 'USD'} ${range}${period}`;
}

export function acceptsApplications(
  job: Pick<JobListingSummaryResponseDto, 'status' | 'applicationDeadline'>,
  today = todayIso(),
): boolean {
  return (
    job.status === JobStatus.OPEN && (!job.applicationDeadline || job.applicationDeadline >= today)
  );
}

export function deadlineLabel(
  job: Pick<JobListingSummaryResponseDto, 'status' | 'applicationDeadline'>,
  today = todayIso(),
): string | null {
  if (CLOSED_JOB_STATUSES.includes(job.status)) return 'Applications closed';
  const deadline = job.applicationDeadline;
  if (!deadline) return null;
  if (deadline < today) return 'Deadline passed';
  if (deadline === today) return 'Closes today';
  return `Apply by ${jobDateLabel(deadline)}`;
}

export function jobStatusClasses(status: JobStatus): string {
  switch (status) {
    case JobStatus.OPEN:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case JobStatus.DRAFT:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
    case JobStatus.ON_HOLD:
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/30';
    case JobStatus.FILLED:
      return 'bg-sky-400/10 text-sky-300 ring-sky-400/30';
    default:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
  }
}

const LABELS: Record<string, string> = {
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  ON_SITE: 'On site',
};

export function enumText(value?: string): string {
  if (!value) return '';
  if (LABELS[value]) return LABELS[value];
  const words = value.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface JobFact {
  label: string;
  value: string;
}

export function jobFacts(job: JobListingResponseDto, today = todayIso()): JobFact[] {
  const years = job.minimumYearsExperience;
  const experience = [
    enumText(job.experienceLevel),
    years === undefined || years === null ? '' : `${years}+ year${years === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const facts: (JobFact | null)[] = [
    fact('Department', [job.department, job.faculty].filter(Boolean).join(', ')),
    fact('Position', job.positionTitle),
    fact('Reports to', job.reportsTo),
    fact('Location', [job.city, job.stateRegion, job.country].filter(Boolean).join(', ')),
    fact('Work', `${enumText(job.employmentType)} · ${enumText(job.workMode)}`),
    fact('Vacancies', String(job.numberOfVacancies ?? 1)),
    fact('Experience', experience),
    fact('Education', job.minimumEducation),
    fact('Salary', salaryLabel(job) ?? ''),
    fact(
      'Deadline',
      job.applicationDeadline
        ? `${jobDateLabel(job.applicationDeadline)}${job.applicationDeadline < today ? ' (passed)' : ''}`
        : '',
    ),
    fact('Expected start', jobDateLabel(job.expectedStartDate)),
  ];
  return facts.filter((f): f is JobFact => f !== null);
}

function fact(label: string, value?: string): JobFact | null {
  return value ? { label, value } : null;
}
