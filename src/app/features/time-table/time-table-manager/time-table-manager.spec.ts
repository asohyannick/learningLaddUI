import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourseSummary } from '../../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeTimeTable, timeTablePage } from '../../../core/testing/fake-time-table';
import { SessionMode, TimeTableStatus } from '../time-table.model';
import { TimeTableManager } from './time-table-manager';

const api = `${environment.apiUrl}/time-table`;
const listUrl = `${api}?page=0&size=20`;
const courseSearch = `${environment.apiUrl}/course/search`;

describe('TimeTableManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimeTableManager],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  /** Answers every pending course lookup (filter and form pickers). */
  function flushCourses() {
    for (const req of backend.match((r) => r.url === courseSearch)) {
      req.flush(ok(coursePage([fakeCourseSummary()])));
    }
  }

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'me', role }));
    const fixture = TestBed.createComponent(TimeTableManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(6);
    backend.expectOne(listUrl).flush(timeTablePage([fakeTimeTable()], 6));
    TestBed.tick();
    flushCourses();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const tick = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!.click();
    const submit = async () => {
      el.querySelector('app-time-table-form form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    const open = async (text: string) => {
      button(text)!.click();
      fixture.detectChanges();
      TestBed.tick();
      flushCourses();
      await fixture.whenStable();
    };
    const reloadAfterSave = () => {
      backend.expectOne(listUrl).flush(timeTablePage([fakeTimeTable()], 6));
      backend.expectOne(`${api}/count`).flush(6);
    };
    return { fixture, el, notified, button, set, tick, submit, open, reloadAfterSave };
  }

  it('lists entries with the total, schedule, place and status; admins may delete', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-testid="timetable-count"]')?.textContent?.trim()).toBe('6');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Weekly lecture');
    expect(row).toContain('Data Science 101');
    expect(row).toContain('Every Monday, 16 Nov 2026 – 22 Feb 2027');
    expect(row).toContain('09:00–11:00');
    expect(row).toContain('Hybrid');
    expect(row).toContain('Scheduled');
    for (const action of ['View', 'Edit', 'Delete']) {
      expect(el.querySelector(`button[aria-label="${action} Weekly lecture"]`)).not.toBeNull();
    }
  });

  it('hides Delete from students, who may still add and edit', async () => {
    const { el, button } = await render(UserRole.STUDENT);
    expect(el.querySelector('button[aria-label="Delete Weekly lecture"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Edit Weekly lecture"]')).not.toBeNull();
    expect(button('Add entry')).toBeDefined();
  });

  it('filters and sorts on the search endpoint, and shows why a PDF export failed', async () => {
    const { fixture, el, button } = await render();
    const [course, status, mode, sort] = [...el.querySelectorAll('select')] as HTMLSelectElement[];
    course.value = 'c-1';
    course.dispatchEvent(new Event('change'));
    mode.value = 'ONLINE';
    mode.dispatchEvent(new Event('change'));
    sort.value = '3'; // Start time, earliest
    sort.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('courseId')).toBe('c-1');
    expect(req.request.params.get('sessionMode')).toBe('ONLINE');
    expect(req.request.params.get('sortBy')).toBe('startTime');
    expect(req.request.params.get('sortDirection')).toBe('asc');
    expect(req.request.params.has('status')).toBe(false);
    expect(status.value).toBe('');
    req.flush(timeTablePage([fakeTimeTable()]));
    await fixture.whenStable();

    button('Download matches (PDF)')!.click();
    const pdf = backend.expectOne((r) => r.url === `${api}/download`);
    expect(pdf.request.params.get('courseId')).toBe('c-1');
    pdf.flush(
      new Blob(
        [
          JSON.stringify({
            status: 400,
            message: 'No timetable entries match the selected filters',
          }),
        ],
        {
          type: 'application/json',
        },
      ),
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No timetable entries match the selected filters',
    );
  });

  it('adds a weekly entry, taking the weekday from the first date', async () => {
    const { fixture, el, notified, set, tick, submit, open, reloadAfterSave } = await render();
    await open('Add entry');
    set('tf-courseId', 'c-1');
    set('tf-title', '  Weekly lab ');
    set('tf-sessionMode', SessionMode.ONLINE);
    set('tf-startDate', '2026-11-18');
    tick('tf-recurring');
    await submit();
    // The last date and the meeting link are required now.
    expect(el.textContent).toContain('Last date is required.');
    expect(el.textContent).toContain('Meeting link is required.');
    expect(el.textContent).toContain('Start time is required.');

    set('tf-endDate', '2027-01-27');
    set('tf-meetingUrl', 'https://meet.example.com/lab');
    set('tf-startTime', '14:00');
    set('tf-endTime', '13:00');
    set('tf-timezone', 'Africa/Douala');
    await submit();
    expect(el.textContent).toContain('End time must be after the start time.');

    set('tf-endTime', '15:30');
    set('tf-capacity', '25');
    await submit();
    const create = backend.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(create.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    expect(create.request.body).toEqual({
      courseId: 'c-1',
      title: 'Weekly lab',
      startDate: '2026-11-18',
      endDate: '2027-01-27',
      startTime: '14:00',
      endTime: '15:30',
      timezone: 'Africa/Douala',
      recurring: true,
      dayOfWeek: 'WEDNESDAY',
      sessionMode: 'ONLINE',
      meetingUrl: 'https://meet.example.com/lab',
      capacity: 25,
    });
    create.flush(fakeTimeTable({ title: 'Weekly lab' }), { status: 201, statusText: 'Created' });
    reloadAfterSave();
    await fixture.whenStable();
    expect(notified).toEqual(['“Weekly lab” was added to the timetable.']);
    expect(el.querySelector('app-time-table-form')).toBeNull();
  });

  it('edits only what changed: cancels the session, clears the notes, makes it one-off', async () => {
    const { fixture, el, notified, set, tick, submit, reloadAfterSave } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Weekly lecture"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/tt-1`).flush(fakeTimeTable());
    await fixture.whenStable();
    expect(el.querySelector('app-time-table-form')?.textContent).toContain('Data Science 101');

    set('tf-status', TimeTableStatus.CANCELLED);
    set('tf-notes', '');
    tick('tf-recurring');
    await submit();
    const update = backend.expectOne(`${api}/tt-1`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ notes: '', recurring: false, status: 'CANCELLED' });
    update.flush(fakeTimeTable({ status: TimeTableStatus.CANCELLED }));
    reloadAfterSave();
    expect(notified).toEqual(['Changes to “Weekly lecture” were saved.']);
  });

  it('opens the panel and deletes the entry from it', async () => {
    const { fixture, el, notified, button } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="View Weekly lecture"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/tt-1`).flush(fakeTimeTable());
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-time-table')!;
    expect(panel.textContent).toContain('Block B, Room 204');
    expect(panel.textContent).toContain('40 learners');
    expect(panel.textContent).toContain('Bring a laptop.');
    expect(panel.querySelector('a[href="https://meet.example.com/ds-101"]')).not.toBeNull();

    [...panel.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
    await fixture.whenStable();
    button('Delete entry')!.click();
    backend.expectOne(`${api}/tt-1`).flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne(listUrl).flush(timeTablePage([], 5));
    backend.expectOne(`${api}/count`).flush(5);
    await fixture.whenStable();
    expect(notified).toEqual(['“Weekly lecture” was removed from the timetable.']);
    expect(el.querySelector('app-fetch-time-table')).toBeNull();
  });
});
