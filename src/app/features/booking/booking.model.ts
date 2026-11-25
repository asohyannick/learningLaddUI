/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

/** PENDING → CONFIRMED (approved) or REJECTED (declined); later CANCELLED, COMPLETED or NO_SHOW. */
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

/* ------------------------------------------------------------------ */
/* Aliases                                                             */
/* ------------------------------------------------------------------ */

/** UUID serialised as a string. */
export type UUID = string;

/** java.time.Instant serialised as an ISO-8601 string, e.g. "2026-11-25T14:00:00Z". */
export type Instant = string;

/* ------------------------------------------------------------------ */
/* Request DTOs                                                        */
/* ------------------------------------------------------------------ */

export interface CreateBookingRequestDto {
  tutorId: UUID;
  courseId?: UUID | null;
  /** Max 200 characters. */
  topic: string;
  /** Max 5,000 characters. */
  studentNotes?: string | null;
  /** Must be in the future. */
  scheduledStart: Instant;
  /** Must be in the future and after scheduledStart. Session length: 15 minutes to 8 hours. */
  scheduledEnd: Instant;
  /** IANA zone, e.g. "Africa/Douala". Defaults to "UTC" on the server. Max 50 characters. */
  timeZone?: string | null;
  sessionMode: SessionMode;
  /** Max 50 characters. */
  meetingPlatform?: string | null;
  /** Max 200 characters. */
  locationName?: string | null;
  /** Max 255 characters. */
  addressLine?: string | null;
  /** Max 100 characters. */
  city?: string | null;
  /** Max 100 characters. */
  stateRegion?: string | null;
  /** Max 100 characters. */
  country?: string | null;
  /** -90 to 90, max 6 decimal places. Must be sent together with longitude. */
  latitude?: number | null;
  /** -180 to 180, max 6 decimal places. Must be sent together with latitude. */
  longitude?: number | null;
  /** Max 500 characters. */
  locationInstructions?: string | null;
}

export const BOOKING_MIN_DURATION_MINUTES = 15;
export const BOOKING_MAX_DURATION_MINUTES = 8 * 60;

/**
 * All fields optional. To reschedule, send both scheduledStart and scheduledEnd.
 * Latitude and longitude must be sent together.
 */
export interface UpdateBookingRequestDto {
  courseId?: UUID | null;
  /** 1 to 200 characters. */
  topic?: string | null;
  /** Max 5,000 characters. */
  studentNotes?: string | null;
  scheduledStart?: Instant | null;
  scheduledEnd?: Instant | null;
  /** Valid IANA zone. Max 50 characters. */
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
  /** Must start with https://. Max 500 characters. */
  meetingLink?: string | null;
  /** Max 100 characters. */
  meetingId?: string | null;
  /** Max 100 characters. */
  meetingPasscode?: string | null;
  /** Note for the student. Max 2,000 characters. */
  tutorNotes?: string | null;
}

export interface DisApproveBookingRequestDto {
  /** Shown to the student. 5 to 500 characters. */
  reason: string;
}

export type BookingSortBy =
  'scheduledStart' | 'createdAt' | 'updatedAt' | 'status' | 'durationMinutes' | 'price';

/** Case-insensitive on the server. */
export type SortDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

/** Query params. All optional; the server applies defaults. */
export interface PagedQueryBookingRequestDto {
  tutorId?: UUID;
  studentId?: UUID;
  courseId?: UUID;
  status?: BookingStatus;
  sessionMode?: SessionMode;
  /** Max 100 characters. */
  keyword?: string;
  /** ISO-8601 date-time. Must be <= startTo. */
  startFrom?: Instant;
  startTo?: Instant;
  /** Zero-based, >= 0. Default 0. */
  page?: number;
  /** 1 to 100. Default 20. */
  size?: number;
  /** Default "scheduledStart". */
  sortBy?: BookingSortBy;
  /** Default "ASC". */
  sortDirection?: SortDirection;
}

export const BOOKING_QUERY_DEFAULTS = {
  page: 0,
  size: 20,
  sortBy: 'scheduledStart',
  sortDirection: 'ASC',
} as const;

/* ------------------------------------------------------------------ */
/* Response DTOs                                                       */
/* ------------------------------------------------------------------ */

/** Null fields are omitted from the JSON (@JsonInclude NON_NULL), so they are optional here. */
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
  /** Primitive int in Java, so always present. */
  rescheduleCount: number;
  lastRescheduledAt?: Instant;
  tutorNotes?: string;

  /** Primitive boolean in Java, so always present. */
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
/* ------------------------------------------------------------------ */
/* Added for the UI                                                    */
/* ------------------------------------------------------------------ */

export const BOOKING_STATUSES = Object.values(BookingStatus);
export const BOOKING_SESSION_MODES = Object.values(SessionMode);

/** Bookings the student can still change (the backend's BookingStatus.isActive()). */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

/** ONLINE and HYBRID sessions need a meeting link before they can be approved. */
export const MEETING_LINK_PATTERN = /^https:\/\/\S+$/;
