import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  CreateTimeTableRequestDto,
  SessionMode,
  TimeTablePageResponseDto,
  TimeTablePagedQueryDto,
  TimeTableResponseDto,
  TimeTableStatus,
  UpdateTimeTableRequestDto,
  shortTime,
} from './time-table.model';

/**
 * Timetable API (`/time-table`). Unlike most of the API, it answers with plain JSON (no
 * `{ success, data }` envelope).
 * - Read, search, count and PDF: any signed-in user.
 * - Create and update (PUT): staff, academic roles and students.
 * - Delete: super admin, admin, IT admin and academic director.
 */
@Injectable({ providedIn: 'root' })
export class TimeTableService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/time-table`;

  /** `GET /time-table`: every entry, newest first. */
  listTimeTables(page = 0, size = 20): Observable<TimeTablePageResponseDto> {
    return this.http.get<TimeTablePageResponseDto>(this.api, { params: { page, size } });
  }

  /** `GET /time-table/search`: keyword, filters, sort and paging. */
  searchTimeTables(query: TimeTablePagedQueryDto): Observable<TimeTablePageResponseDto> {
    return this.http.get<TimeTablePageResponseDto>(`${this.api}/search`, {
      params: toParams(query),
    });
  }

  /** `GET /time-table/count`: every entry, in any status. */
  countTimeTables(): Observable<number> {
    return this.http.get<number>(`${this.api}/count`).pipe(map(Number));
  }

  /** `GET /time-table/{id}` */
  getTimeTable(id: string): Observable<TimeTableResponseDto> {
    return this.http.get<TimeTableResponseDto>(`${this.api}/${id}`);
  }

  /**
   * `POST /time-table`. The `Idempotency-Key` (8–100 characters) is required: reuse the same key
   * when retrying, so a slow network never creates the entry twice.
   */
  createTimeTable(
    data: CreateTimeTableRequestDto,
    idempotencyKey: string,
  ): Observable<TimeTableResponseDto> {
    return this.http.post<TimeTableResponseDto>(this.api, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  /** `PUT /time-table/{id}`: only the fields sent are changed (at least one). */
  updateTimeTable(id: string, data: UpdateTimeTableRequestDto): Observable<TimeTableResponseDto> {
    return this.http.put<TimeTableResponseDto>(`${this.api}/${id}`, data);
  }

  /** `DELETE /time-table/{id}` (204, no body). */
  deleteTimeTable(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  /**
   * `GET /time-table/download`: a PDF of every entry matching the filters, in the chosen order
   * (page and size are ignored; at most 5,000 entries). Emits the saved file name.
   */
  downloadTimeTablesPdf(query: TimeTablePagedQueryDto = {}): Observable<string> {
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
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'timetable.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  /**
   * PDF of one entry. The API only exports by filter, so this narrows by course, title, date
   * and start time; another entry with the same title, course, date and time would be included.
   */
  downloadTimeTablePdf(entry: TimeTableResponseDto): Observable<string> {
    const time = shortTime(entry.startTime);
    return this.downloadTimeTablesPdf({
      keyword: entry.title.slice(0, 100),
      courseId: entry.courseId,
      fromDate: entry.startDate,
      toDate: entry.startDate,
      startTimeFrom: time,
      startTimeTo: time,
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

// ─── Display helpers ─────────────────────────────────────────────────

/** "09:00–11:00" */
export function timeRange(entry: Pick<TimeTableResponseDto, 'startTime' | 'endTime'>): string {
  return `${shortTime(entry.startTime)}–${shortTime(entry.endTime)}`;
}

/** "2 h", "1 h 30 min", "45 min" */
export function durationLabel(minutes: number | undefined | null): string {
  if (!minutes || minutes < 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Mon 16 Nov 2026" from an ISO date, read as a calendar date. */
export function dateLabel(date: string | undefined | null): string {
  if (!date) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Every Monday, 16 Nov 2026 – 22 Feb 2027" or "Mon 16 Nov 2026". */
export function scheduleLabel(
  entry: Pick<TimeTableResponseDto, 'recurring' | 'dayOfWeek' | 'startDate' | 'endDate'>,
): string {
  if (!entry.recurring) return dateLabel(entry.startDate);
  const day = entry.dayOfWeek
    ? entry.dayOfWeek.charAt(0) + entry.dayOfWeek.slice(1).toLowerCase()
    : 'week';
  const strip = (label: string) => label.replace(/^\w+ /, '');
  const range = entry.endDate
    ? `${strip(dateLabel(entry.startDate))} – ${strip(dateLabel(entry.endDate))}`
    : `from ${strip(dateLabel(entry.startDate))}`;
  return `Every ${day}, ${range}`;
}

/** Badge colours on the dark dashboard. */
export function timeTableStatusClasses(status: TimeTableStatus | undefined): string {
  switch (status) {
    case TimeTableStatus.ONGOING:
      return 'bg-sky-400/10 text-sky-300 ring-sky-400/30';
    case TimeTableStatus.COMPLETED:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case TimeTableStatus.CANCELLED:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
    case TimeTableStatus.POSTPONED:
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/30';
    default:
      return 'bg-indigo-400/10 text-indigo-300 ring-indigo-400/30';
  }
}

export function sessionModeClasses(mode: SessionMode | undefined): string {
  switch (mode) {
    case SessionMode.ONLINE:
      return 'bg-cyan-400/10 text-cyan-300';
    case SessionMode.IN_PERSON:
      return 'bg-violet-400/10 text-violet-300';
    default:
      return 'bg-fuchsia-400/10 text-fuchsia-300';
  }
}
