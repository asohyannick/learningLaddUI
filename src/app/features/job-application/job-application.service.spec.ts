import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { applicationPage, fakeJobApplication } from '../../core/testing/fake-job-application';
import { ok } from '../../core/testing/fake-login-response';
import { ApplicationStatus } from './job-application.model';
import {
  JobApplicationService,
  applicationFacts,
  canEditApplication,
} from './job-application.service';

const api = `${environment.apiUrl}/job-application`;

describe('JobApplicationService', () => {
  let service: JobApplicationService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobApplicationService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists, counts and fetches one application from the envelope', () => {
    let listed = 0;
    let total = 0;
    let email = '';
    service.listApplications(2, 50).subscribe((page) => (listed = page.totalElements));
    service.countApplications().subscribe((count) => (total = count));
    service.getApplication('app-1').subscribe((a) => (email = a.email));
    backend.expectOne(`${api}?page=2&size=50`).flush(applicationPage([fakeJobApplication()], 3));
    backend.expectOne(`${api}/count`).flush(ok(9));
    backend.expectOne(`${api}/app-1`).flush(ok(fakeJobApplication()));
    expect(listed).toBe(3);
    expect(total).toBe(9);
    expect(email).toBe('amara@example.com');
  });

  it('searches with filters and downloads without paging', () => {
    service
      .searchApplications({
        keyword: ' ndip ',
        status: ApplicationStatus.SHORTLISTED,
        jobListingId: '',
        submittedFrom: '2026-11-01T00:00:00Z',
        sortBy: 'lastName',
        sortDirection: 'asc',
        page: 1,
      })
      .subscribe();
    const search = backend.expectOne((r) => r.url === `${api}/search`);
    expect(search.request.params.get('keyword')).toBe('ndip');
    expect(search.request.params.get('status')).toBe('SHORTLISTED');
    expect(search.request.params.get('submittedFrom')).toBe('2026-11-01T00:00:00Z');
    expect(search.request.params.has('jobListingId')).toBe(false);
    search.flush(applicationPage([]));

    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let name = '';
    service.downloadApplicationPdf(fakeJobApplication()).subscribe((n) => (name = n));
    const pdf = backend.expectOne((r) => r.url === `${api}/download`);
    expect(pdf.request.params.get('keyword')).toBe('amara@example.com');
    expect(pdf.request.params.get('jobListingId')).toBe('job-1');
    expect(pdf.request.params.has('page')).toBe(false);
    pdf.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="job-applications-2026-11-24.pdf"' },
    });
    expect(name).toBe('job-applications-2026-11-24.pdf');
    save.mockRestore();
  });

  it('submits with the Idempotency-Key, updates as multipart and deletes', async () => {
    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    service
      .submitApplication(
        {
          jobListingId: 'job-1',
          firstName: 'A',
          lastName: 'N',
          email: 'a@x.io',
          consentGiven: true,
        },
        { cv },
        'key-12345678',
      )
      .subscribe();
    const submit = backend.expectOne(api);
    expect(submit.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    expect((submit.request.body as FormData).get('cv')).toBe(cv);
    submit.flush(ok(fakeJobApplication()));

    service.updateApplication('app-1', { city: 'Yaoundé', supportingDocuments: [] }).subscribe();
    const update = backend.expectOne(`${api}/app-1`);
    expect(update.request.method).toBe('PATCH');
    const data = (update.request.body as FormData).get('data') as Blob;
    expect(JSON.parse(await data.text())).toEqual({ city: 'Yaoundé', supportingDocuments: [] });
    expect((update.request.body as FormData).has('cv')).toBe(false);
    update.flush(ok(fakeJobApplication({ city: 'Yaoundé' })));

    let message = '';
    service.deleteApplication('app-1').subscribe((m) => (message = m));
    const remove = backend.expectOne(`${api}/app-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ ...ok(null), message: 'Job application deleted successfully' });
    expect(message).toBe('Job application deleted successfully');
  });

  it('describes an application', () => {
    const facts = applicationFacts(fakeJobApplication());
    expect(facts).toContainEqual({ label: 'Expected salary', value: 'XAF 300,000 / month' });
    expect(facts).toContainEqual({ label: 'Experience', value: '4 years' });
    expect(facts).toContainEqual({ label: 'Submitted', value: '22 Nov 2026' });
    expect(canEditApplication(fakeJobApplication())).toBe(true);
    expect(canEditApplication(fakeJobApplication({ status: ApplicationStatus.UNDER_REVIEW }))).toBe(
      false,
    );
  });
});
