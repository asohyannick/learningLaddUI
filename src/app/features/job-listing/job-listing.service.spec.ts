import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { fakeJobListing, fakeJobSummary, jobPage } from '../../core/testing/fake-job-listing';
import { EmploymentType, JobStatus } from './job-listing.model';
import {
  JobListingService,
  acceptsApplications,
  deadlineLabel,
  jobFacts,
  salaryLabel,
} from './job-listing.service';

const api = `${environment.apiUrl}/job-listing`;
const ok = <T>(data: T) => ({
  success: true,
  status: 200,
  message: 'Done.',
  data,
  path: '',
  timestamp: '',
});

describe('JobListingService', () => {
  let service: JobListingService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(JobListingService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('unwraps list, count and one listing from the envelope', () => {
    let listed = 0;
    let total = 0;
    let title = '';
    service.listJobListings(1, 50).subscribe((page) => (listed = page.totalElements));
    service.countJobListings().subscribe((count) => (total = count));
    service.getJobListing('job-1').subscribe((job) => (title = job.title));
    backend.expectOne(`${api}?page=1&size=50`).flush(jobPage([fakeJobSummary()], 3));
    backend.expectOne(`${api}/count`).flush(ok(7));
    backend.expectOne(`${api}/job-1`).flush(ok(fakeJobListing()));
    expect(listed).toBe(3);
    expect(total).toBe(7);
    expect(title).toBe('Lecturer in Mathematics');
  });

  it('searches with filters, leaving out empty ones; open roles force openOnly', () => {
    service
      .searchJobListings({
        search: ' maths ',
        employmentType: EmploymentType.CONTRACT,
        city: '',
        minSalary: 0,
      })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('search')).toBe('maths');
    expect(req.request.params.get('employmentType')).toBe('CONTRACT');
    expect(req.request.params.get('minSalary')).toBe('0');
    expect(req.request.params.has('city')).toBe(false);
    req.flush(jobPage([]));

    service.searchOpenJobListings({ size: 3 }).subscribe();
    const open = backend.expectOne((r) => r.url === `${api}/search`);
    expect(open.request.params.get('openOnly')).toBe('true');
    expect(open.request.params.get('sortBy')).toBe('publishedAt');
    open.flush(jobPage([]));
  });

  it('creates and updates as multipart with a JSON data part and the photo', async () => {
    const photo = new File(['x'], 'job.png', { type: 'image/png' });
    service
      .createJobListing({ title: 'Librarian', description: 'Run the library.' }, photo)
      .subscribe();
    const create = backend.expectOne(api);
    expect(create.request.method).toBe('POST');
    const body = create.request.body as FormData;
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      title: 'Librarian',
      description: 'Run the library.',
    });
    expect((body.get('data') as Blob).type).toBe('application/json');
    expect(body.get('photo')).toBe(photo);
    create.flush(ok(fakeJobListing()));

    service.updateJobListing('job-1', { status: JobStatus.OPEN }).subscribe();
    const update = backend.expectOne(`${api}/job-1`);
    expect(update.request.method).toBe('PATCH');
    expect(
      JSON.parse(await ((update.request.body as FormData).get('data') as Blob).text()),
    ).toEqual({
      status: 'OPEN',
    });
    expect((update.request.body as FormData).has('photo')).toBe(false);
    update.flush(ok(fakeJobListing()));

    let message = '';
    service.deleteJobListing('job-1').subscribe((m) => (message = m));
    const remove = backend.expectOne(`${api}/job-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ ...ok(null), message: 'Job listing deleted successfully.' });
    expect(message).toBe('Job listing deleted successfully.');
  });

  it('downloads matches without paging, and one listing by its reference code', () => {
    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let fileName = '';
    service
      .downloadJobListingsPdf({ status: JobStatus.OPEN, page: 2, size: 10 })
      .subscribe((name) => (fileName = name));
    const all = backend.expectOne((r) => r.url === `${api}/download`);
    expect(all.request.params.get('status')).toBe('OPEN');
    expect(all.request.params.has('page')).toBe(false);
    all.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="job-listings-2026-11-24.pdf"' },
    });
    expect(fileName).toBe('job-listings-2026-11-24.pdf');

    service.downloadJobListingPdf(fakeJobSummary()).subscribe();
    const one = backend.expectOne((r) => r.url === `${api}/download`);
    expect(one.request.params.get('search')).toBe('JOB-2026-0042');
    one.flush(new Blob(['%PDF']));
    save.mockRestore();
  });

  it('formats salary, deadline and facts', () => {
    const job = fakeJobListing();
    expect(salaryLabel(job)).toBe('XAF 250,000 – 400,000 / month');
    expect(salaryLabel({ ...job, salaryVisible: false })).toBeNull();
    expect(salaryLabel({ ...job, salaryMax: undefined })).toBe('XAF From 250,000 / month');
    expect(deadlineLabel(job, '2026-11-24')).toBe('Apply by 31 Dec 2099');
    expect(deadlineLabel({ ...job, applicationDeadline: '2026-11-24' }, '2026-11-24')).toBe(
      'Closes today',
    );
    expect(deadlineLabel({ ...job, status: JobStatus.FILLED })).toBe('Applications closed');
    expect(acceptsApplications(job, '2026-11-24')).toBe(true);
    expect(acceptsApplications({ ...job, applicationDeadline: '2026-11-01' }, '2026-11-24')).toBe(
      false,
    );
    expect(acceptsApplications({ ...job, status: JobStatus.DRAFT })).toBe(false);
    const facts = jobFacts(job, '2026-11-24');
    expect(facts).toContainEqual({ label: 'Work', value: 'Full time · Hybrid' });
    expect(facts).toContainEqual({ label: 'Experience', value: 'Mid · 3+ years' });
    expect(facts.find((f) => f.label === 'Reports to')).toBeUndefined();
  });
});
