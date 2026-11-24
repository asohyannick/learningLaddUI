import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { applicationPage, fakeJobApplication } from '../../../core/testing/fake-job-application';
import { fakeJobListing, fakeJobSummary, jobPage } from '../../../core/testing/fake-job-listing';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { JobApplicationManager } from './job-application-manager';

const api = `${environment.apiUrl}/job-application`;
const jobsSearch = `${environment.apiUrl}/job-listing/search`;

describe('JobApplicationManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobApplicationManager],
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

  async function render() {
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'admin', role: UserRole.SUPER_ADMIN }),
    );
    const fixture = TestBed.createComponent(JobApplicationManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(7));
    backend.expectOne(`${api}?page=0&size=20`).flush(applicationPage([fakeJobApplication()], 7));
    TestBed.tick();
    backend.expectOne((r) => r.url === jobsSearch).flush(jobPage([fakeJobSummary()]));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    return { fixture, el, notified, button };
  }

  it('lists applications with the total, job title, status and CV link', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-testid="application-count"]')?.textContent?.trim()).toBe('7');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Amara Ndip');
    expect(row).toContain('amara@example.com');
    expect(row).toContain('Lecturer in Mathematics');
    expect(row).toContain('22 Nov 2026');
    expect(row).toContain('Submitted');
    expect(el.querySelector('a[href="https://files.example.org/cv.pdf"]')).not.toBeNull();
  });

  it('filters by status and job on the search endpoint', async () => {
    const { fixture, el } = await render();
    const [job, status] = [...el.querySelectorAll('select')] as HTMLSelectElement[];
    job.value = 'job-1';
    job.dispatchEvent(new Event('change'));
    status.value = 'HIRED';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('jobListingId')).toBe('job-1');
    expect(req.request.params.get('status')).toBe('HIRED');
    expect(req.request.params.get('sortBy')).toBe('submittedAt');
    req.flush(applicationPage([]));
    await fixture.whenStable();
    expect(el.textContent).toContain('No applications match your filters.');
  });

  it('opens an application in the panel and deletes it', async () => {
    const { fixture, el, notified, button } = await render();
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="View application from Amara Ndip"]',
    )!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/app-1`).flush(ok(fakeJobApplication()));
    await fixture.whenStable();
    backend.expectOne(`${environment.apiUrl}/job-listing/job-1`).flush(ok(fakeJobListing()));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-job-application')!;
    expect(panel.textContent).toContain('Applied for Lecturer in Mathematics (JOB-2026-0042)');
    expect(panel.textContent).toContain('XAF 300,000 / month');
    expect(panel.textContent).toContain('I love teaching maths.');
    expect(panel.querySelector('a[href="https://files.example.org/doc-1.pdf"]')).not.toBeNull();

    [...panel.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
    await fixture.whenStable();
    button('Delete application')!.click();
    backend.expectOne(`${api}/app-1`).flush(ok(null));
    backend.expectOne(`${api}?page=0&size=20`).flush(applicationPage([], 6));
    backend.expectOne(`${api}/count`).flush(ok(6));
    await fixture.whenStable();
    expect(notified).toEqual(['The application from Amara Ndip was deleted.']);
    expect(el.querySelector('app-fetch-job-application')).toBeNull();
  });

  it('submits an application from the dashboard for an open job', async () => {
    const { fixture, el, notified, button } = await render();
    button('Submit application')!.click();
    fixture.detectChanges();
    TestBed.tick();
    const open = backend.expectOne((r) => r.url === jobsSearch);
    expect(open.request.params.get('openOnly')).toBe('true');
    open.flush(jobPage([fakeJobSummary()]));
    await fixture.whenStable();

    const job = el.querySelector<HTMLSelectElement>('#sa-job')!;
    job.value = 'job-1';
    job.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    button('Continue')!.click();
    backend.expectOne(`${environment.apiUrl}/job-listing/job-1`).flush(ok(fakeJobListing()));
    await fixture.whenStable();

    const form = el.querySelector('app-apply-form form')!;
    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    const cvInput = el.querySelector<HTMLInputElement>('#ap-cv')!;
    Object.defineProperty(cvInput, 'files', { value: [cv] });
    cvInput.dispatchEvent(new Event('change'));
    for (const [id, value] of [
      ['ap-firstName', 'Amara'],
      ['ap-lastName', 'Ndip'],
      ['ap-email', 'amara@example.com'],
    ]) {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    el.querySelector<HTMLInputElement>('#ap-consent')!.click();
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const submit = backend.expectOne(api);
    expect(submit.request.method).toBe('POST');
    expect(submit.request.headers.has('Idempotency-Key')).toBe(true);
    expect((submit.request.body as FormData).get('cv')).toBe(cv);
    submit.flush(ok(fakeJobApplication({ id: 'app-2' })), { status: 201, statusText: 'Created' });
    backend.expectOne(`${api}?page=0&size=20`).flush(applicationPage([fakeJobApplication()], 8));
    backend.expectOne(`${api}/count`).flush(ok(8));
    await fixture.whenStable();
    expect(notified).toEqual(['The application from Amara Ndip was submitted.']);
    expect(el.querySelector('app-apply-form')).toBeNull();
    expect(localStorage.getItem('ll.jobApplicationId.admin')).toBe('app-2');
    localStorage.removeItem('ll.jobApplicationId.admin');
  });
});
