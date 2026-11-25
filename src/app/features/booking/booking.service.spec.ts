import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { bookingPage, fakeBooking } from '../../core/testing/fake-booking';
import { ok } from '../../core/testing/fake-login-response';
import { BookingStatus, SessionMode } from './booking.model';
import {
  BookingService,
  bookingDuration,
  bookingWhen,
  canApprove,
  canDecline,
} from './booking.service';

const api = `${environment.apiUrl}/booking`;

describe('BookingService', () => {
  let service: BookingService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists, searches, counts and fetches bookings', () => {
    service.listBookings(1, 50).subscribe();
    service
      .searchBookings({
        studentId: 'me',
        status: BookingStatus.PENDING,
        keyword: ' calc ',
        tutorId: '',
      })
      .subscribe();
    let count = 0;
    service.countBookings().subscribe((n) => (count = n));
    service.getBooking('bk-1').subscribe();
    backend.expectOne(`${api}?page=1&size=50`).flush(bookingPage([]));
    const search = backend.expectOne((r) => r.url === `${api}/search`);
    expect(search.request.params.get('studentId')).toBe('me');
    expect(search.request.params.get('keyword')).toBe('calc');
    expect(search.request.params.has('tutorId')).toBe(false);
    search.flush(bookingPage([]));
    backend.expectOne(`${api}/count`).flush(ok(6));
    backend.expectOne(`${api}/bk-1`).flush(ok(fakeBooking()));
    expect(count).toBe(6);
  });

  it('adds with an Idempotency-Key, updates, approves, declines and deletes', () => {
    service
      .addBooking(
        {
          tutorId: 'tp-1',
          topic: 'Limits',
          scheduledStart: '2099-01-01T10:00:00Z',
          scheduledEnd: '2099-01-01T11:00:00Z',
          sessionMode: SessionMode.ONLINE,
        },
        'key-12345678',
      )
      .subscribe();
    const add = backend.expectOne(api);
    expect(add.request.method).toBe('POST');
    expect(add.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    add.flush(ok(fakeBooking()));

    service.updateBooking('bk-1', { topic: 'Series' }).subscribe();
    service.approveBooking('bk-1', { meetingLink: 'https://meet.example.com/x' }).subscribe();
    service.disapproveBooking('bk-1', { reason: 'Tutor away' }).subscribe();
    for (const [path, body] of [
      ['bk-1', { topic: 'Series' }],
      ['bk-1/approve', { meetingLink: 'https://meet.example.com/x' }],
      ['bk-1/disapprove', { reason: 'Tutor away' }],
    ] as const) {
      const req = backend.expectOne(`${api}/${path}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(body);
      req.flush(ok(fakeBooking()));
    }

    service.deleteBooking('bk-1').subscribe();
    expect(backend.expectOne(`${api}/bk-1`).request.method).toBe('DELETE');
  });

  it('downloads matches without paging, and one booking by reference', () => {
    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let name = '';
    service
      .downloadBookingsPdf({ status: BookingStatus.CONFIRMED, page: 2, size: 10 })
      .subscribe((n) => (name = n));
    const all = backend.expectOne((r) => r.url === `${api}/download`);
    expect(all.request.params.get('status')).toBe('CONFIRMED');
    expect(all.request.params.has('page')).toBe(false);
    all.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="bookings-2026-11-25.pdf"' },
    });
    expect(name).toBe('bookings-2026-11-25.pdf');

    service.downloadBookingPdf(fakeBooking()).subscribe();
    const one = backend.expectOne((r) => r.url === `${api}/download`);
    expect(one.request.params.get('keyword')).toBe('BK-2026-0012');
    one.flush(new Blob(['%PDF']));
    save.mockRestore();
  });

  it('describes bookings and which decisions are possible', () => {
    expect(bookingWhen(fakeBooking())).toBe('Wed 2 Dec 2099, 13:00–14:30 (UTC)');
    expect(bookingWhen(fakeBooking({ timeZone: 'Africa/Douala' }))).toBe(
      'Wed 2 Dec 2099, 14:00–15:30 (Africa/Douala)',
    );
    expect(bookingDuration(90)).toBe('1 h 30 min');
    expect(canApprove(fakeBooking())).toBe(true);
    expect(canApprove(fakeBooking({ scheduledStart: '2020-01-01T10:00:00Z' }))).toBe(false);
    expect(canDecline(fakeBooking({ status: BookingStatus.CONFIRMED }))).toBe(false);
  });
});
