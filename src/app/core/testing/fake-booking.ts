import {
  BookingPageResponseDto,
  BookingResponseDto,
  BookingStatus,
  SessionMode,
} from '../../features/booking/booking.model';

/** A pending online session with tutor tp-1, booked by user "me", far in the future. */
export function fakeBooking(overrides: Partial<BookingResponseDto> = {}): BookingResponseDto {
  return {
    id: 'bk-1',
    bookingReference: 'BK-2026-0012',
    studentId: 'me',
    tutorId: 'tp-1',
    topic: 'Integration by parts',
    studentNotes: 'Chapter 4 exercises',
    scheduledStart: '2099-12-02T13:00:00Z',
    scheduledEnd: '2099-12-02T14:30:00Z',
    durationMinutes: 90,
    timeZone: 'UTC',
    sessionMode: SessionMode.ONLINE,
    meetingPlatform: 'Zoom',
    status: BookingStatus.PENDING,
    rescheduleCount: 0,
    reminderSent: false,
    createdAt: '2026-11-25T09:00:00Z',
    updatedAt: '2026-11-25T09:00:00Z',
    ...overrides,
  };
}

/** `{ success, data: BookingPageResponseDto }` as the API sends it. */
export function bookingPage(content: BookingResponseDto[], totalElements = content.length) {
  const data: BookingPageResponseDto = {
    content,
    page: 0,
    size: 20,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / 20)),
    first: true,
    last: totalElements <= 20,
  };
  return { success: true, status: 200, message: 'OK', data, path: '', timestamp: '' };
}
