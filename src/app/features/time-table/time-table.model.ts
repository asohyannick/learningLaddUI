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

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export type UUID = string;
export type ISODate = string;
export type ISOTime = string;
export type IANATimezone = string;

export interface CreateTimeTableRequestDto {
  courseId: UUID;
  title: string;
  description?: string;
  notes?: string;
  startDate: ISODate;
  endDate?: ISODate;
  startTime: ISOTime;
  endTime: ISOTime;
  timezone?: IANATimezone;
  recurring?: boolean;
  dayOfWeek?: DayOfWeek;
  sessionMode: SessionMode;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
}

export interface UpdateTimeTableRequestDto {
  title?: string;
  description?: string;
  notes?: string;
  startDate?: ISODate;
  endDate?: ISODate;
  startTime?: ISOTime;
  endTime?: ISOTime;
  timezone?: IANATimezone;
  recurring?: boolean;
  dayOfWeek?: DayOfWeek;
  sessionMode?: SessionMode;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
  status?: TimeTableStatus;
}

export type TimeTableSortBy =
  'title' | 'startDate' | 'startTime' | 'endTime' | 'status' | 'sessionMode' | 'createdAt';

export type TimeTableSortDirection = 'asc' | 'desc';

export interface TimeTablePagedQueryDto {
  keyword?: string;
  courseId?: UUID;
  status?: TimeTableStatus;
  sessionMode?: SessionMode;
  dayOfWeek?: DayOfWeek;
  recurring?: boolean;
  fromDate?: ISODate;
  toDate?: ISODate;
  startTimeFrom?: ISOTime;
  startTimeTo?: ISOTime;
  page?: number;
  size?: number;
  sortBy?: TimeTableSortBy;
  sortDirection?: TimeTableSortDirection;
}

export const TIMETABLE_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  maxSize: 100,
  sortBy: 'startDate',
  sortDirection: 'asc',
} as const;

export interface TimeTableResponseDto {
  id: UUID;
  courseId: UUID;
  courseName: string;
  courseSlug?: string;
  title: string;
  description?: string;
  notes?: string;
  startDate: ISODate;
  endDate?: ISODate;
  startTime: ISOTime;
  endTime: ISOTime;
  durationMinutes: number;
  timezone: IANATimezone;
  recurring: boolean;
  dayOfWeek?: DayOfWeek;
  sessionMode: SessionMode;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
  status: TimeTableStatus;
  createdBy?: UUID;
  createdAt?: string;
  updatedAt?: string;
}

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

export const TIMETABLE_MAX_EXPORT_ROWS = 5000;

export const MEETING_URL_PATTERN = /^https?:\/\/\S+$/;

export function dayOfWeekOf(date: ISODate): DayOfWeek | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const day = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])).getUTCDay();
  return DAYS_OF_WEEK[(day + 6) % 7];
}

export function shortTime(time: ISOTime | undefined | null): string {
  return time ? time.slice(0, 5) : '';
}
