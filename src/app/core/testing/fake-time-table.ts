import {
  DayOfWeek,
  SessionMode,
  TimeTablePageResponseDto,
  TimeTableResponseDto,
  TimeTableStatus,
} from '../../features/time-table/time-table.model';

export function fakeTimeTable(overrides: Partial<TimeTableResponseDto> = {}): TimeTableResponseDto {
  return {
    id: 'tt-1',
    courseId: 'c-1',
    courseName: 'Data Science 101',
    courseSlug: 'data-science-101',
    title: 'Weekly lecture',
    description: 'Regression and classification.',
    notes: 'Bring a laptop.',
    startDate: '2026-11-16',
    endDate: '2027-02-22',
    startTime: '09:00:00',
    endTime: '11:00:00',
    durationMinutes: 120,
    timezone: 'Africa/Douala',
    recurring: true,
    dayOfWeek: DayOfWeek.MONDAY,
    sessionMode: SessionMode.HYBRID,
    location: 'Block B, Room 204',
    meetingUrl: 'https://meet.example.com/ds-101',
    capacity: 40,
    status: TimeTableStatus.SCHEDULED,
    createdBy: 'u-1',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-02T08:00:00Z',
    ...overrides,
  };
}

export function timeTablePage(
  content: TimeTableResponseDto[],
  totalElements = content.length,
): TimeTablePageResponseDto {
  return {
    content,
    pageNumber: 0,
    pageSize: 20,
    numberOfElements: content.length,
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / 20)),
    first: true,
    last: true,
    hasNext: false,
    hasPrevious: false,
  };
}
