import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { fakeTimeTable, timeTablePage } from '../../core/testing/fake-time-table';
import { DayOfWeek, SessionMode, TimeTableStatus, dayOfWeekOf } from './time-table.model';
import { TimeTableService, durationLabel, scheduleLabel, timeRange } from './time-table.service';

const api = `${environment.apiUrl}/time-table`;

describe('TimeTableService', () => {
  let service: TimeTableService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TimeTableService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads plain JSON (no envelope) for list, count and one entry', () => {
    let total = 0;
    let title = '';
    let listed = 0;
    service.listTimeTables(1, 50).subscribe((page) => (listed = page.totalElements));
    service.countTimeTables().subscribe((count) => (total = count));
    service.getTimeTable('tt-1').subscribe((entry) => (title = entry.title));
    backend.expectOne(`${api}?page=1&size=50`).flush(timeTablePage([fakeTimeTable()], 3));
    backend.expectOne(`${api}/count`).flush(12);
    backend.expectOne(`${api}/tt-1`).flush(fakeTimeTable());
    expect(listed).toBe(3);
    expect(total).toBe(12);
    expect(title).toBe('Weekly lecture');
  });

  it('sends search filters and leaves out empty ones', () => {
    service
      .searchTimeTables({
        keyword: ' algebra ',
        status: TimeTableStatus.SCHEDULED,
        sessionMode: SessionMode.ONLINE,
        dayOfWeek: DayOfWeek.MONDAY,
        recurring: false,
        fromDate: '2026-11-01',
        startTimeTo: '18:00',
        courseId: '',
        page: 2,
        size: 50,
        sortBy: 'startTime',
        sortDirection: 'desc',
      })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    const params = req.request.params;
    expect(params.get('keyword')).toBe('algebra');
    expect(params.get('recurring')).toBe('false');
    expect(params.get('dayOfWeek')).toBe('MONDAY');
    expect(params.get('startTimeTo')).toBe('18:00');
    expect(params.get('page')).toBe('2');
    expect(params.get('sortDirection')).toBe('desc');
    expect(params.has('courseId')).toBe(false);
    req.flush(timeTablePage([]));
  });

  it('creates with the Idempotency-Key header, updates with PUT and deletes', () => {
    service
      .createTimeTable(
        {
          courseId: 'c-1',
          title: 'Lab',
          startDate: '2026-11-20',
          startTime: '14:00',
          endTime: '15:30',
          sessionMode: SessionMode.IN_PERSON,
          location: 'Lab 3',
        },
        'key-12345678',
      )
      .subscribe();
    const create = backend.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(create.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    expect(create.request.body.title).toBe('Lab');
    create.flush(fakeTimeTable());

    service.updateTimeTable('tt-1', { status: TimeTableStatus.CANCELLED }).subscribe();
    const update = backend.expectOne(`${api}/tt-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ status: 'CANCELLED' });
    update.flush(fakeTimeTable({ status: TimeTableStatus.CANCELLED }));

    let deleted = false;
    service.deleteTimeTable('tt-1').subscribe(() => (deleted = true));
    const remove = backend.expectOne(`${api}/tt-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
    expect(deleted).toBe(true);
  });

  it('downloads matches without paging, and one entry by course, title, date and time', () => {
    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let fileName = '';
    service
      .downloadTimeTablesPdf({ status: TimeTableStatus.SCHEDULED, page: 3, size: 10 })
      .subscribe((name) => (fileName = name));
    const all = backend.expectOne((r) => r.url === `${api}/download`);
    expect(all.request.params.get('status')).toBe('SCHEDULED');
    expect(all.request.params.has('page')).toBe(false);
    expect(all.request.params.has('size')).toBe(false);
    all.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="timetable-2026-11-24.pdf"' },
    });
    expect(fileName).toBe('timetable-2026-11-24.pdf');

    service.downloadTimeTablePdf(fakeTimeTable()).subscribe();
    const one = backend.expectOne((r) => r.url === `${api}/download`);
    const p = one.request.params;
    expect(p.get('keyword')).toBe('Weekly lecture');
    expect(p.get('courseId')).toBe('c-1');
    expect(p.get('fromDate')).toBe('2026-11-16');
    expect(p.get('toDate')).toBe('2026-11-16');
    expect(p.get('startTimeFrom')).toBe('09:00');
    expect(p.get('startTimeTo')).toBe('09:00');
    one.flush(new Blob(['%PDF']));
    save.mockRestore();
  });

  it('formats days, times and schedules', () => {
    expect(dayOfWeekOf('2026-11-16')).toBe(DayOfWeek.MONDAY);
    expect(dayOfWeekOf('2026-11-22')).toBe(DayOfWeek.SUNDAY);
    expect(dayOfWeekOf('nope')).toBeNull();
    expect(timeRange(fakeTimeTable())).toBe('09:00–11:00');
    expect(durationLabel(120)).toBe('2 h');
    expect(durationLabel(90)).toBe('1 h 30 min');
    expect(durationLabel(45)).toBe('45 min');
    expect(scheduleLabel(fakeTimeTable())).toBe('Every Monday, 16 Nov 2026 – 22 Feb 2027');
    expect(scheduleLabel(fakeTimeTable({ recurring: false, endDate: undefined }))).toBe(
      'Mon 16 Nov 2026',
    );
  });
});
