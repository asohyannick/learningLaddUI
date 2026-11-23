import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ok } from '../../core/testing/fake-login-response';
import { coursePage } from '../../core/testing/fake-course';
import { fakeStudentProfile, fakeStudentSummary } from '../../core/testing/fake-student-profile';
import { StudentProfileService } from './student-profile.service';

const api = `${environment.apiUrl}/student-profile`;

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StudentProfileService);
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
    service.getProfile('sp-1').subscribe((p) => (name = p.firstName));

    backend.expectOne(`${api}?page=1&size=10`).flush(ok(coursePage([fakeStudentSummary()], 1)));
    backend.expectOne(`${api}/count`).flush(ok(41));
    backend.expectOne(`${api}/sp-1`).flush(ok(fakeStudentProfile()));
    expect(total).toBe(42);
    expect(name).toBe('Amara');
  });

  it('sends only the filled-in search parameters', () => {
    service
      .searchProfiles({ search: ' ada ', faculty: '', currentLevel: 3, sortBy: 'lastName' })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.keys().sort()).toEqual(['currentLevel', 'search', 'sortBy']);
    expect(req.request.params.get('search')).toBe('ada');
    req.flush(ok(coursePage([])));
  });

  it('creates a profile as multipart with an idempotency key', async () => {
    const picture = new File(['x'], 'me.png', { type: 'image/png' });
    service
      .createProfile(
        { firstName: 'Amara', lastName: 'Okafor' },
        { profilePicture: picture },
        'key-12345',
      )
      .subscribe();
    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-12345');
    const body = req.request.body as FormData;
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      firstName: 'Amara',
      lastName: 'Okafor',
    });
    expect((body.get('profilePicture') as File).name).toBe('me.png');
    req.flush(ok(fakeStudentProfile()));
  });

  it('updates and deletes a profile', () => {
    let message = '';
    service.updateProfile('sp-1', { city: 'Yaoundé' }).subscribe();
    service.deleteProfile('sp-1').subscribe((m) => (message = m));
    const patch = backend.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.url).toBe(`${api}/sp-1`);
    patch.flush(ok(fakeStudentProfile({ city: 'Yaoundé' })));
    backend
      .expectOne((r) => r.method === 'DELETE')
      .flush(ok(null, 'Student profile deleted successfully.'));
    expect(message).toBe('Student profile deleted successfully.');
  });

  it('exports the filtered list as PDF without paging parameters', () => {
    const save = stubSave();
    let fileName = '';
    service
      .downloadProfilesPdf({ enrollmentStatus: 'ACTIVE', page: 2, size: 50 })
      .subscribe((name) => (fileName = name));
    const req = backend.expectOne((r) => r.url === `${api}/download`);
    expect(req.request.params.keys()).toEqual(['enrollmentStatus']);
    req.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="student-profiles-20261123.pdf"' },
    });
    expect(fileName).toBe('student-profiles-20261123.pdf');
    expect(save).toHaveBeenCalledOnce();
  });

  it('exports one profile by searching for its email', () => {
    stubSave();
    service.downloadProfilePdf(fakeStudentSummary()).subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/download`);
    expect(req.request.params.get('search')).toBe('amara@example.com');
    req.flush(new Blob(['%PDF']));
  });
});
