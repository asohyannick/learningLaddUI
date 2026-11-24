// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export enum SessionMode {
  ONLINE = 'ONLINE',
  IN_PERSON = 'IN_PERSON',
  HYBRID = 'HYBRID',
}

export enum TimeTableStatus {
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
}

/** java.time.DayOfWeek, which Jackson sends as its name. */
export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// ─────────────────────────────────────────────────────────────
// Shared scalar aliases (how Jackson serializes the Java types)
// ─────────────────────────────────────────────────────────────

/** java.util.UUID */
export type UUID = string;
/** java.time.LocalDate, ISO date: "2026-11-16" */
export type ISODate = string;
/** java.time.LocalTime: "09:00" or "09:00:00" */
export type ISOTime = string;
/** IANA zone id, e.g. "Africa/Douala" */
export type IANATimezone = string;

// ─────────────────────────────────────────────────────────────
// Requests
// ─────────────────────────────────────────────────────────────
// Rules between fields that the backend checks:
// - endTime must be after startTime
// - endDate cannot be before startDate
// - recurring: true requires dayOfWeek and endDate; otherwise both must be omitted
// - when recurring, startDate must fall on dayOfWeek
// - ONLINE and HYBRID need meetingUrl; IN_PERSON and HYBRID need location
// - timezone must be a valid IANA zone id

/** The Idempotency-Key goes in a request header, not in this body. */
export interface CreateTimeTableRequestDto {
  /** Required */
  courseId: UUID;
  /** Required, max 200 */
  title: string;
  /** Max 5000 */
  description?: string;
  /** Max 2000. Extra notes for learners, e.g. what to bring. */
  notes?: string;
  /** Required. Date of the session, or the first date when recurring. */
  startDate: ISODate;
  /** Last date of a recurring entry. Omit for a one-off session. */
  endDate?: ISODate;
  /** Required, in the given timezone */
  startTime: ISOTime;
  /** Required, must be after startTime */
  endTime: ISOTime;
  /** Max 60. Defaults to UTC. */
  timezone?: IANATimezone;
  /** True when the session repeats weekly. Defaults to false. */
  recurring?: boolean;
  /** Required when recurring, otherwise omit */
  dayOfWeek?: DayOfWeek;
  /** Required */
  sessionMode: SessionMode;
  /** Max 255. Required for IN_PERSON and HYBRID. */
  location?: string;
  /** Max 500, must start with http:// or https://. Required for ONLINE and HYBRID. */
  meetingUrl?: string;
  /** 1–100000 */
  capacity?: number;
}

/**
 * Only the fields you send are changed, and at least one is required.
 * Send "" to clear description, notes, location or meetingUrl.
 * Setting recurring to false also clears dayOfWeek and endDate.
 * The rules between fields are checked against the entry as it will look after the update.
 */
export interface UpdateTimeTableRequestDto {
  /** 1–200 */
  title?: string;
  /** Max 5000. "" clears it. */
  description?: string;
  /** Max 2000. "" clears it. */
  notes?: string;
  startDate?: ISODate;
  endDate?: ISODate;
  startTime?: ISOTime;
  endTime?: ISOTime;
  /** Max 60 */
  timezone?: IANATimezone;
  recurring?: boolean;
  dayOfWeek?: DayOfWeek;
  sessionMode?: SessionMode;
  /** Max 255. "" clears it. */
  location?: string;
  /** Max 500, must start with http:// or https://. "" clears it. */
  meetingUrl?: string;
  /** 1–100000 */
  capacity?: number;
  /** Use CANCELLED or POSTPONED to flag a session without deleting it */
  status?: TimeTableStatus;
}

export type TimeTableSortBy =
  'title' | 'startDate' | 'startTime' | 'endTime' | 'status' | 'sessionMode' | 'createdAt';

/** The backend lowercases this, so 'ASC' / 'DESC' also work. */
export type TimeTableSortDirection = 'asc' | 'desc';

/** Sent as query parameters. */
export interface TimeTablePagedQueryDto {
  /** Max 100. Matches the entry title and the course name. */
  keyword?: string;
  courseId?: UUID;
  status?: TimeTableStatus;
  sessionMode?: SessionMode;
  /** Only recurring entries on this day */
  dayOfWeek?: DayOfWeek;
  /** true for recurring entries only, false for one-off sessions only */
  recurring?: boolean;
  /** Entries still running on or after this date. Must not be after toDate. */
  fromDate?: ISODate;
  /** Entries that start on or before this date */
  toDate?: ISODate;
  /** Entries starting at or after this time (HH:mm). Must not be after startTimeTo. */
  startTimeFrom?: ISOTime;
  /** Entries starting at or before this time (HH:mm) */
  startTimeTo?: ISOTime;
  /** Zero-based, >= 0. Defaults to 0. */
  page?: number;
  /** >= 1. Defaults to 20; values above 100 are capped at 100. */
  size?: number;
  /** Defaults to "startDate" */
  sortBy?: TimeTableSortBy;
  /** Defaults to "asc" */
  sortDirection?: TimeTableSortDirection;
}

export const TIMETABLE_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  maxSize: 100,
  sortBy: 'startDate',
  sortDirection: 'asc',
} as const;

// ─────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────
// The time-table API returns plain JSON, not the usual `{ success, data }` envelope.
// Null fields are left out (`default-property-inclusion: non_null`).

/** `TimeTableResponseDto` */
export interface TimeTableResponseDto {
  id: UUID;
  courseId: UUID;
  courseName: string;
  courseSlug?: string;
  title: string;
  description?: string;
  notes?: string;
  startDate: ISODate;
  /** Only on recurring entries */
  endDate?: ISODate;
  startTime: ISOTime;
  endTime: ISOTime;
  durationMinutes: number;
  timezone: IANATimezone;
  recurring: boolean;
  /** Only on recurring entries */
  dayOfWeek?: DayOfWeek;
  sessionMode: SessionMode;
  location?: string;
  meetingUrl?: string;
  /** Missing when unlimited */
  capacity?: number;
  status: TimeTableStatus;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string;
}

/** `PagedResponseDto<TimeTableResponseDto>` */
export interface TimeTablePageResponseDto {
  content: TimeTableResponseDto[];
  pageNumber: number;
  pageSize: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export const SESSION_MODES = Object.values(SessionMode);
export const TIMETABLE_STATUSES = Object.values(TimeTableStatus);
export const DAYS_OF_WEEK = Object.values(DayOfWeek);

/** Most entries `GET /time-table/download` exports at once. */
export const TIMETABLE_MAX_EXPORT_ROWS = 5000;

/** Same rule as the backend `@Pattern` on `meetingUrl`. */
export const MEETING_URL_PATTERN = /^https?:\/\/\S+$/;

/** The weekday of an ISO date ("2026-11-16" → MONDAY), read as a calendar date (no time zone). */
export function dayOfWeekOf(date: ISODate): DayOfWeek | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).getUTCDay();
  // getUTCDay: 0 = Sunday … 6 = Saturday; DAYS_OF_WEEK starts on Monday.
  return DAYS_OF_WEEK[(day + 6) % 7];
}

/** "09:00:00" → "09:00" */
export function shortTime(time: ISOTime | undefined | null): string {
  return time ? time.slice(0, 5) : '';
}
