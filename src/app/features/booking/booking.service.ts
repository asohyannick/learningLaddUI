import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/interface';
import { fileNameFromDisposition, saveBlob } from '../../shared/utils/download';
import {
  ACTIVE_BOOKING_STATUSES,
  ApproveBookingRequestDto,
  BookingPageResponseDto,
  BookingResponseDto,
  BookingStatus,
  CreateBookingRequestDto,
  DisApproveBookingRequestDto,
  PagedQueryBookingRequestDto,
  SessionMode,
  UpdateBookingRequestDto,
} from './booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/booking`;

  addBooking(
    data: CreateBookingRequestDto,
    idempotencyKey: string,
  ): Observable<ApiResponse<BookingResponseDto>> {
    return this.http.post<ApiResponse<BookingResponseDto>>(this.api, data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  listBookings(page = 0, size = 20): Observable<BookingPageResponseDto> {
    return this.http
      .get<ApiResponse<BookingPageResponseDto>>(this.api, { params: { page, size } })
      .pipe(map((res) => res.data));
  }

  searchBookings(query: PagedQueryBookingRequestDto): Observable<BookingPageResponseDto> {
    return this.http
      .get<ApiResponse<BookingPageResponseDto>>(`${this.api}/search`, { params: toParams(query) })
      .pipe(map((res) => res.data));
  }

  countBookings(): Observable<number> {
    return this.http
      .get<ApiResponse<number>>(`${this.api}/count`)
      .pipe(map((res) => Number(res.data)));
  }

  getBooking(id: string): Observable<BookingResponseDto> {
    return this.http
      .get<ApiResponse<BookingResponseDto>>(`${this.api}/${encodeURIComponent(id)}`)
      .pipe(map((res) => res.data));
  }

  updateBooking(
    id: string,
    data: UpdateBookingRequestDto,
  ): Observable<ApiResponse<BookingResponseDto>> {
    return this.http.patch<ApiResponse<BookingResponseDto>>(`${this.api}/${id}`, data);
  }

  deleteBooking(id: string): Observable<string> {
    return this.http.delete<ApiResponse<null>>(`${this.api}/${id}`).pipe(map((res) => res.message));
  }

  approveBooking(
    id: string,
    data: ApproveBookingRequestDto,
  ): Observable<ApiResponse<BookingResponseDto>> {
    return this.http.patch<ApiResponse<BookingResponseDto>>(`${this.api}/${id}/approve`, data);
  }

  disapproveBooking(
    id: string,
    data: DisApproveBookingRequestDto,
  ): Observable<ApiResponse<BookingResponseDto>> {
    return this.http.patch<ApiResponse<BookingResponseDto>>(`${this.api}/${id}/disapprove`, data);
  }

  downloadBookingsPdf(query: PagedQueryBookingRequestDto = {}): Observable<string> {
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
            fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? 'bookings.pdf';
          saveBlob(res.body ?? new Blob([], { type: 'application/pdf' }), fileName);
          return fileName;
        }),
      );
  }

  downloadBookingPdf(booking: Pick<BookingResponseDto, 'bookingReference'>): Observable<string> {
    return this.downloadBookingsPdf({ keyword: booking.bookingReference });
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function partsIn(iso: string, timeZone = 'UTC') {
  const date = new Date(iso);
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(date);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone);
  } catch {
    parts = format('UTC');
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: get('hour'),
    minute: get('minute'),
    weekday: get('weekday'),
  };
}

export function bookingWhen(
  b: Pick<BookingResponseDto, 'scheduledStart' | 'scheduledEnd' | 'timeZone'>,
): string {
  if (!b.scheduledStart) return '';
  const zone = b.timeZone || 'UTC';
  const s = partsIn(b.scheduledStart, zone);
  const end = b.scheduledEnd ? partsIn(b.scheduledEnd, zone) : null;
  const weekday = WEEKDAYS.find((d) => s.weekday.startsWith(d)) ?? s.weekday;
  return `${weekday} ${s.day} ${MONTHS[s.month - 1]} ${s.year}, ${s.hour}:${s.minute}${
    end ? `–${end.hour}:${end.minute}` : ''
  } (${zone})`;
}

export function bookingDuration(minutes?: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

export function bookingDate(value?: string): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : value;
}

export function isActiveBooking(b: Pick<BookingResponseDto, 'status'>): boolean {
  return !!b.status && ACTIVE_BOOKING_STATUSES.includes(b.status);
}

export function canApprove(
  b: Pick<BookingResponseDto, 'status' | 'scheduledStart'>,
  now = Date.now(),
): boolean {
  return (
    b.status === BookingStatus.PENDING && !!b.scheduledStart && Date.parse(b.scheduledStart) > now
  );
}

export function canDecline(b: Pick<BookingResponseDto, 'status'>): boolean {
  return b.status === BookingStatus.PENDING;
}

export function needsMeetingLink(mode?: SessionMode): boolean {
  return mode === SessionMode.ONLINE || mode === SessionMode.HYBRID;
}

export function bookingStatusClasses(status?: BookingStatus): string {
  switch (status) {
    case BookingStatus.PENDING:
      return 'bg-amber-400/10 text-amber-300 ring-amber-400/30';
    case BookingStatus.CONFIRMED:
      return 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30';
    case BookingStatus.COMPLETED:
      return 'bg-sky-400/10 text-sky-300 ring-sky-400/30';
    case BookingStatus.CANCELLED:
      return 'bg-slate-400/10 text-slate-300 ring-slate-400/30';
    default:
      return 'bg-rose-400/10 text-rose-300 ring-rose-400/30';
  }
}

export function bookingPlace(
  b: Pick<BookingResponseDto, 'locationName' | 'addressLine' | 'city' | 'country'>,
): string {
  return [b.locationName, b.addressLine, b.city, b.country].filter(Boolean).join(', ');
}
