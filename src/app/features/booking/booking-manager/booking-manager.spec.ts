import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourseSummary } from '../../../core/testing/fake-course';
import { bookingPage, fakeBooking } from '../../../core/testing/fake-booking';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeTutorSummary } from '../../../core/testing/fake-tutor-profile';
import { BookingStatus, SessionMode } from '../booking.model';
import { BookingManager } from './booking-manager';

const api = `${environment.apiUrl}/booking`;
const tutorSearch = `${environment.apiUrl}/tutor-profile/search`;
const courseSearch = `${environment.apiUrl}/course/search`;

describe('BookingManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingManager],
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

  function flushPickers() {
    for (const req of backend.match((r) => r.url === tutorSearch)) {
      req.flush(ok(tutorPage()));
    }
    for (const req of backend.match((r) => r.url === courseSearch)) {
      req.flush(ok(coursePage([fakeCourseSummary()])));
    }
  }

  function tutorPage() {
    const content = [
      fakeTutorSummary({ id: 'tp-1', firstName: 'Chidi', lastName: 'Eze', title: 'Dr.' }),
    ];
    return {
      content,
      page: 0,
      size: 100,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    };
  }

  async function setup(role: UserRole, mode: 'staff' | 'student', rows = [fakeBooking()]) {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'me', role }));
    const fixture = TestBed.createComponent(BookingManager);
    fixture.componentRef.setInput('mode', mode);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    if (mode === 'staff') {
      backend.expectOne(`${api}/count`).flush(ok(rows.length));
      backend.expectOne(`${api}?page=0&size=20`).flush(bookingPage(rows));
    } else {
      const mine = backend.expectOne((r) => r.url === `${api}/search`);
      expect(mine.request.params.get('studentId')).toBe('me');
      mine.flush(bookingPage(rows));
    }
    TestBed.tick();
    flushPickers();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
      );
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(
        new Event(
          input instanceof HTMLSelectElement || input.type === 'date' || input.type === 'time'
            ? 'change'
            : 'input',
        ),
      );
      input.dispatchEvent(new Event('input'));
    };
    return { fixture, el, notified, button, set };
  }

  it('shows admins every booking with the total, tutor and the decisions a pending one allows', async () => {
    const { el, button } = await setup(UserRole.SUPER_ADMIN, 'staff');
    expect(el.querySelector('[data-testid="booking-count"]')?.textContent?.trim()).toBe('1');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Integration by parts');
    expect(row).toContain('with Dr. Chidi Eze');
    expect(row).toContain('Wed 2 Dec 2099, 13:00–14:30 (UTC)');
    expect(button('Approve booking BK-2026-0012')).toBeDefined();
    expect(button('Decline booking BK-2026-0012')).toBeDefined();
    expect(button('Edit booking BK-2026-0012')).toBeUndefined();
    expect(button('Book a session')).toBeUndefined();
  });

  it('gives lecturers the same tools for the bookings made with them', async () => {
    const { fixture, el, notified, button, set } = await setup(UserRole.LECTURER, 'staff');
    expect(el.textContent).toContain('Bookings with you');
    const tutorFilter = [...el.querySelectorAll('label')].find((l) =>
      l.textContent?.includes('Any tutor'),
    )!;
    expect(tutorFilter.hidden).toBe(true);
    expect(button('Download all (PDF)')).toBeDefined();
    expect(button('Delete booking BK-2026-0012')).toBeDefined();

    button('Decline booking BK-2026-0012')!.click();
    await fixture.whenStable();
    set('bd-reason', 'Fully booked that day');
    el.querySelector('app-booking-decision form')!.dispatchEvent(new Event('submit'));
    backend
      .expectOne(`${api}/bk-1/disapprove`)
      .flush({ ...ok(fakeBooking({ status: BookingStatus.REJECTED })), message: 'Declined.' });
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(bookingPage([fakeBooking({ status: BookingStatus.REJECTED })]));
    backend.expectOne(`${api}/count`).flush(ok(1));
    await fixture.whenStable();
    expect(notified).toEqual(['Declined.']);
  });

  it('approves an online booking only with an https meeting link', async () => {
    const { fixture, el, notified, button, set } = await setup(UserRole.ADMIN, 'staff');
    button('Approve booking BK-2026-0012')!.click();
    await fixture.whenStable();
    const form = el.querySelector('app-booking-decision form')!;
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Add a meeting link');
    set('bd-link', 'http://insecure.example.com');
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('The link must start with https://');
    backend.expectNone(`${api}/bk-1/approve`);

    set('bd-link', 'https://meet.example.com/abc');
    set('bd-notes', 'See you there');
    form.dispatchEvent(new Event('submit'));
    const approve = backend.expectOne(`${api}/bk-1/approve`);
    expect(approve.request.body).toEqual({
      meetingLink: 'https://meet.example.com/abc',
      tutorNotes: 'See you there',
    });
    approve.flush({
      ...ok(fakeBooking({ status: BookingStatus.CONFIRMED })),
      message: 'Booking confirmed.',
    });
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(bookingPage([fakeBooking({ status: BookingStatus.CONFIRMED })]));
    backend.expectOne(`${api}/count`).flush(ok(1));
    await fixture.whenStable();
    expect(notified).toEqual(['Booking confirmed.']);
    expect(button('Approve booking BK-2026-0012')).toBeUndefined();
  });

  it('declines with a reason and deletes', async () => {
    const { fixture, el, notified, button, set } = await setup(UserRole.SUPER_ADMIN, 'staff');
    button('Decline booking BK-2026-0012')!.click();
    await fixture.whenStable();
    set('bd-reason', 'Tutor away');
    el.querySelector('app-booking-decision form')!.dispatchEvent(new Event('submit'));
    const decline = backend.expectOne(`${api}/bk-1/disapprove`);
    expect(decline.request.body).toEqual({ reason: 'Tutor away' });
    decline.flush({ ...ok(fakeBooking({ status: BookingStatus.REJECTED })), message: 'Declined.' });
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(bookingPage([fakeBooking({ status: BookingStatus.REJECTED })]));
    backend.expectOne(`${api}/count`).flush(ok(1));
    await fixture.whenStable();

    button('Delete booking BK-2026-0012')!.click();
    await fixture.whenStable();
    el.querySelector('app-booking-decision form')!.dispatchEvent(new Event('submit'));
    backend.expectOne(`${api}/bk-1`).flush({ ...ok(null), message: 'Booking deleted.' });
    backend.expectOne(`${api}?page=0&size=20`).flush(bookingPage([]));
    backend.expectOne(`${api}/count`).flush(ok(0));
    await fixture.whenStable();
    expect(notified).toEqual(['Declined.', 'Booking deleted.']);
  });

  it('lets a student book a tutor, sending the times and their time zone', async () => {
    const { fixture, el, notified, button, set } = await setup(UserRole.STUDENT, 'student', []);
    expect(button('Approve booking BK-2026-0012')).toBeUndefined();
    button('Book a session')!.click();
    fixture.detectChanges();
    TestBed.tick();
    flushPickers();
    await fixture.whenStable();

    set('bk-tutorId', 'tp-1');
    set('bk-topic', ' Limits ');
    set('bk-date', '2099-03-10');
    set('bk-startTime', '10:00');
    set('bk-endTime', '10:05');
    set('bk-sessionMode', SessionMode.IN_PERSON);
    el.querySelector('app-booking-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('A session lasts between 15 minutes and 8 hours.');
    expect(el.textContent).toContain('In-person sessions need a place or an address.');

    set('bk-endTime', '11:30');
    set('bk-locationName', 'Library, room 2');
    el.querySelector('app-booking-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    const add = backend.expectOne(api);
    expect(add.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    expect(add.request.body).toEqual({
      tutorId: 'tp-1',
      scheduledStart: new Date('2099-03-10T10:00:00').toISOString(),
      scheduledEnd: new Date('2099-03-10T11:30:00').toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      sessionMode: 'IN_PERSON',
      topic: 'Limits',
      locationName: 'Library, room 2',
    });
    add.flush(
      { ...ok(fakeBooking()), message: 'Booking requested.' },
      { status: 201, statusText: 'Created' },
    );
    backend.expectOne((r) => r.url === `${api}/search`).flush(bookingPage([fakeBooking()]));
    await fixture.whenStable();
    expect(notified).toEqual(['Booking requested.']);
    expect(el.querySelector('app-booking-form')).toBeNull();
  });

  it('lets a student reschedule, sending both new times', async () => {
    const { fixture, el, notified, button, set } = await setup(UserRole.STUDENT, 'student');
    button('Edit booking BK-2026-0012')!.click();
    fixture.detectChanges();
    TestBed.tick();
    flushPickers();
    await fixture.whenStable();
    expect(el.querySelector<HTMLSelectElement>('#bk-tutorId')!.disabled).toBe(true);
    set('bk-date', '2099-12-03');
    el.querySelector('app-booking-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    const update = backend.expectOne(`${api}/bk-1`);
    expect(update.request.method).toBe('PATCH');
    expect(Object.keys(update.request.body).sort()).toEqual([
      'scheduledEnd',
      'scheduledStart',
      'timeZone',
    ]);
    expect(update.request.body.scheduledStart.slice(0, 10)).toMatch(/^2099-12-0[23]$/);
    update.flush({ ...ok(fakeBooking()), message: 'Booking updated.' });
    backend.expectOne((r) => r.url === `${api}/search`).flush(bookingPage([fakeBooking()]));
    await fixture.whenStable();
    expect(notified).toEqual(['Booking updated.']);
  });
});
