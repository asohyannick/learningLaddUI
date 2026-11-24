import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeJobListing } from '../../../core/testing/fake-job-listing';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { JobStatus } from '../job-listing.model';
import { JobDetail } from './job-detail';

const jobUrl = `${environment.apiUrl}/job-listing/job-1`;
const applyUrl = `${environment.apiUrl}/job-application`;

describe('JobDetail', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobDetail],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    localStorage.removeItem('ll.jobApplicationId.me');
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
    localStorage.removeItem('ll.jobApplicationId.me');
  });

  async function render(signedIn = true) {
    if (signedIn) {
      TestBed.inject(AuthService).startSession(
        fakeLoginResponse({
          id: 'me',
          role: UserRole.STUDENT,
          firstName: 'Amara',
          lastName: 'Ndip',
          email: 'amara@example.com',
        }),
      );
    }
    const fixture = TestBed.createComponent(JobDetail);
    fixture.componentRef.setInput('id', 'job-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('asks guests to sign in and come back to this job', async () => {
    const { fixture, el } = await render(false);
    await fixture.whenStable();
    expect(el.textContent).toContain('Sign in to read this job and apply');
    expect(el.querySelector('a[href="/login?returnUrl=%2Fjobs%2Fjob-1"]')).not.toBeNull();
  });

  it('treats drafts as not available', async () => {
    const { fixture, el } = await render();
    backend.expectOne(jobUrl).flush(ok(fakeJobListing({ status: JobStatus.DRAFT })));
    await fixture.whenStable();
    expect(el.textContent).toContain("This job isn't available");
  });

  it('shows the full description and sends an application with the CV', async () => {
    const { fixture, el } = await render();
    backend.expectOne(jobUrl).flush(ok(fakeJobListing()));
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('Lecturer in Mathematics');
    expect(el.textContent).toContain('Join our maths department.');
    expect(el.textContent).toContain("A master's degree in mathematics.");
    expect(el.textContent).toContain('XAF 250,000 – 400,000 / month');
    expect(el.textContent).toContain('Apply by 31 Dec 2099');

    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    button('Apply for this job')!.click();
    await fixture.whenStable();
    const form = el.querySelector('app-apply-form form')!;
    expect(el.querySelector<HTMLInputElement>('#ap-email')!.value).toBe('amara@example.com');

    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Attach your CV (PDF, DOC or DOCX).');
    expect(el.textContent).toContain('Please agree before sending your application.');
    backend.expectNone(applyUrl);

    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    const cvInput = el.querySelector<HTMLInputElement>('#ap-cv')!;
    Object.defineProperty(cvInput, 'files', { value: [cv] });
    cvInput.dispatchEvent(new Event('change'));
    const salary = el.querySelector<HTMLInputElement>('#ap-expectedSalary')!;
    salary.value = '300000';
    salary.dispatchEvent(new Event('input'));
    el.querySelector<HTMLInputElement>('#ap-consent')!.click();
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const apply = backend.expectOne(applyUrl);
    expect(apply.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    const body = apply.request.body as FormData;
    expect(body.get('cv')).toBe(cv);
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      jobListingId: 'job-1',
      consentGiven: true,
      firstName: 'Amara',
      lastName: 'Ndip',
      email: 'amara@example.com',
      expectedSalary: 300000,
      expectedSalaryCurrency: 'XAF',
      expectedSalaryPeriod: 'MONTHLY',
    });
    apply.flush(ok({ id: 'app-1', jobListingId: 'job-1', status: 'SUBMITTED' }), {
      status: 201,
      statusText: 'Created',
    });
    await fixture.whenStable();
    expect(el.querySelector('app-apply-form')).toBeNull();
    expect(el.textContent).toContain('Application sent');
    expect(localStorage.getItem('ll.jobApplicationId.me')).toBe('app-1');
    expect(el.querySelector('a[href="/job-applications"]')).not.toBeNull();
  });

  it('sends people who already applied to their application instead', async () => {
    localStorage.setItem('ll.jobApplicationId.me', 'app-1');
    const { fixture, el } = await render();
    backend.expectOne(jobUrl).flush(ok(fakeJobListing()));
    await fixture.whenStable();
    const box = el.querySelector('[data-testid="already-applied"]');
    expect(box?.textContent).toContain("You've already applied");
    expect(box?.querySelector('a[href="/job-applications"]')).not.toBeNull();
    const buttons = [...el.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(buttons).not.toContain('Apply for this job');
  });
});
