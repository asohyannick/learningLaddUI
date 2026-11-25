export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REQUIRES_ACTION = 'REQUIRES_ACTION',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
}

export enum SessionMode {
  ONLINE = 'ONLINE',
  IN_PERSON = 'IN_PERSON',
  HYBRID = 'HYBRID',
}

export type UUID = string;

export type Instant = string;

export interface CreateBookingRequestDto {
  tutorId: UUID;
  courseId?: UUID | null;
  topic: string;
  studentNotes?: string | null;
  scheduledStart: Instant;
  scheduledEnd: Instant;
  timeZone?: string | null;
  sessionMode: SessionMode;
  meetingPlatform?: string | null;
  locationName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationInstructions?: string | null;
}

export const BOOKING_MIN_DURATION_MINUTES = 15;
export const BOOKING_MAX_DURATION_MINUTES = 8 * 60;

export interface UpdateBookingRequestDto {
  courseId?: UUID | null;
  topic?: string | null;
  studentNotes?: string | null;
  scheduledStart?: Instant | null;
  scheduledEnd?: Instant | null;
  timeZone?: string | null;
  sessionMode?: SessionMode | null;
  meetingPlatform?: string | null;
  locationName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationInstructions?: string | null;
}

export interface ApproveBookingRequestDto {
  meetingLink?: string | null;
  meetingId?: string | null;
  meetingPasscode?: string | null;
  tutorNotes?: string | null;
}

export interface DisApproveBookingRequestDto {
  reason: string;
}

export type BookingSortBy =
  'scheduledStart' | 'createdAt' | 'updatedAt' | 'status' | 'durationMinutes' | 'price';

export type SortDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

export interface PagedQueryBookingRequestDto {
  tutorId?: UUID;
  studentId?: UUID;
  courseId?: UUID;
  status?: BookingStatus;
  sessionMode?: SessionMode;
  keyword?: string;
  startFrom?: Instant;
  startTo?: Instant;
  page?: number;
  size?: number;
  sortBy?: BookingSortBy;
  sortDirection?: SortDirection;
}

export const BOOKING_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'scheduledStart',
  sortDirection: 'ASC',
} as const;

export interface BookingResponseDto {
  id?: UUID;
  bookingReference?: string;

  studentId?: UUID;
  tutorId?: UUID;
  courseId?: UUID;

  topic?: string;
  studentNotes?: string;

  scheduledStart?: Instant;
  scheduledEnd?: Instant;
  durationMinutes?: number;
  timeZone?: string;

  sessionMode?: SessionMode;
  meetingPlatform?: string;
  meetingLink?: string;
  meetingId?: string;
  meetingPasscode?: string;
  locationName?: string;
  addressLine?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  locationInstructions?: string;

  price?: number;
  currency?: string;
  paymentStatus?: PaymentStatus;

  status?: BookingStatus;
  confirmedAt?: Instant;
  rejectedAt?: Instant;
  rejectionReason?: string;
  cancelledAt?: Instant;
  cancelledBy?: UUID;
  cancellationReason?: string;
  completedAt?: Instant;
  rescheduleCount: number;
  lastRescheduledAt?: Instant;
  tutorNotes?: string;

  reminderSent: boolean;
  reminderSentAt?: Instant;

  createdAt?: Instant;
  updatedAt?: Instant;
}

export interface BookingPageResponseDto {
  content: BookingResponseDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const BOOKING_STATUSES = Object.values(BookingStatus);
export const BOOKING_SESSION_MODES = Object.values(SessionMode);

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export const MEETING_LINK_PATTERN = /^https:\/\/\S+$/;
