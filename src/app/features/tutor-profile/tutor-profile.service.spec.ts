import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { coursePage } from '../../core/testing/fake-course';
import { ok } from '../../core/testing/fake-login-response';
import { fakeTutorProfile, fakeTutorSummary } from '../../core/testing/fake-tutor-profile';
import { TutorProfileService, hourlyRateLabel, tutorName } from './tutor-profile.service';

const api = `${environment.apiUrl}/tutor-profile`;

describe('TutorProfileService', () => {
  let service: TutorProfileService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TutorProfileService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  function stubSave() {
    URL.createObjectURL ??= () => '';
    URL.revokeObjectURL ??= () => undefined;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  }

  it('lists, counts and fetches profiles', () => {
    let total = 0;
    let name = '';
    service.listProfiles(1, 10).subscribe((page) => (total = page.totalElements));
    service.countProfiles().subscribe((count) => (total += count));
    service.getProfile('tp-1').subscribe((p) => (name = p.firstName));

    backend.expectOne(`${api}?page=1&size=10`).flush(ok(coursePage([fakeTutorSummary()], 1)));
    backend.expectOne(`${api}/count`).flush(ok(11));
    backend.expectOne(`${api}/tp-1`).flush(ok(fakeTutorProfile()));
    expect(total).toBe(12);
    expect(name).toBe('Chidi');
  });

  it('sends only the filled-in search parameters', () => {
    service
      .searchProfiles({
        search: ' eze ',
        faculty: '',
        subject: 'Calculus',
        minYearsOfExperience: 5,
        status: 'ACTIVE',
      })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.keys().sort()).toEqual([
      'minYearsOfExperience',
      'search',
      'status',
      'subject',
    ]);
    expect(req.request.params.get('search')).toBe('eze');
    req.flush(ok(coursePage([])));
  });

  it('creates a profile as multipart with an idempotency key', async () => {
    const picture = new File(['x'], 'me.png', { type: 'image/png' });
    service
      .createProfile(
        { firstName: 'Chidi', lastName: 'Eze', hourlyRate: 25, currency: 'USD' },
        { profilePicture: picture },
        'key-12345',
      )
      .subscribe();
    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-12345');
    const body = req.request.body as FormData;
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      firstName: 'Chidi',
      lastName: 'Eze',
      hourlyRate: 25,
      currency: 'USD',
    });
    expect((body.get('profilePicture') as File).name).toBe('me.png');
    req.flush(ok(fakeTutorProfile()));
  });

  it('updates and deletes a profile', () => {
    let message = '';
    service.updateProfile('tp-1', { subjects: ['Calculus'] }).subscribe();
    service.deleteProfile('tp-1').subscribe((m) => (message = m));
    const patch = backend.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.url).toBe(`${api}/tp-1`);
    patch.flush(ok(fakeTutorProfile({ subjects: ['Calculus'] })));
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(ok(null, 'Tutor profile deleted successfully.'));
    expect(message).toBe('Tutor profile deleted successfully.');
  });

  it('exports the filtered list as PDF without paging parameters', () => {
    const save = stubSave();
    let fileName = '';
    service
      .downloadProfilesPdf({ status: 'ACTIVE', page: 2, size: 50 })
      .subscribe((name) => (fileName = name));
    const req = backend.expectOne((r) => r.url === `${api}/download`);
    expect(req.request.params.keys()).toEqual(['status']);
    req.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="tutor-profiles-20261123.pdf"' },
    });
    expect(fileName).toBe('tutor-profiles-20261123.pdf');
    expect(save).toHaveBeenCalledOnce();
  });

  it('exports one profile by searching for its email', () => {
    stubSave();
    service.downloadProfilePdf(fakeTutorSummary()).subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/download`);
    expect(req.request.params.get('search')).toBe('chidi@example.com');
    req.flush(new Blob(['%PDF']));
  });

  it('formats names with titles and hourly rates', () => {
    expect(tutorName(fakeTutorSummary())).toBe('Dr. Chidi Eze');
    expect(tutorName(fakeTutorSummary({ title: undefined }))).toBe('Chidi Eze');
    expect(hourlyRateLabel({ hourlyRate: 2500, currency: 'xaf' })).toBe('2,500.00 XAF / hour');
    expect(hourlyRateLabel({})).toBeNull();
  });
});
