import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UserRole } from '../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../core/interceptor/error.interceptor';
import { AuthService } from '../../core/service/auth/auth.service';
import { fakeJobApplication } from '../../core/testing/fake-job-application';
import { fakeJobListing } from '../../core/testing/fake-job-listing';
import { fakeLoginResponse, ok } from '../../core/testing/fake-login-response';
import { JobApplication } from './job-application';
import { ApplicationStatus } from './job-application.model';

const api = `${environment.apiUrl}/job-application`;
const storageKey = 'll.jobApplicationId.me';

describe('JobApplication (my application)', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(storageKey);
    await TestBed.configureTestingModule({
      imports: [JobApplication],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'me', role: UserRole.STUDENT }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
    localStorage.removeItem(storageKey);
  });

  async function render() {
    const fixture = TestBed.createComponent(JobApplication);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('invites people who have not applied to browse open roles', async () => {
    const { fixture, el } = await render();
    await fixture.whenStable();
    expect(el.textContent).toContain("You haven't applied yet");
    expect(el.querySelector('a[href="/jobs"]')).not.toBeNull();
  });

  it('shows the application and saves only the changed fields', async () => {
    localStorage.setItem(storageKey, 'app-1');
    const { fixture, el } = await render();
    backend.expectOne(`${api}/app-1`).flush(ok(fakeJobApplication()));
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    backend.expectOne(`${environment.apiUrl}/job-listing/job-1`).flush(ok(fakeJobListing()));
    await fixture.whenStable();
    expect(el.textContent).toContain('Lecturer in Mathematics');
    expect(el.querySelector('[data-testid="application-status"]')?.textContent).toContain(
      'Submitted',
    );
    expect(el.querySelector('a[href="https://files.example.org/cv.pdf"]')).not.toBeNull();

    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Edit application')!
      .click();
    await fixture.whenStable();
    const city = el.querySelector<HTMLInputElement>('#ap-city')!;
    expect(city.value).toBe('Douala');
    city.value = 'Yaoundé';
    city.dispatchEvent(new Event('input'));
    [...el.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'Remove attached document 1')!
      .click();
    el.querySelector('app-apply-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const update = backend.expectOne(`${api}/app-1`);
    expect(update.request.method).toBe('PATCH');
    const data = (update.request.body as FormData).get('data') as Blob;
    expect(JSON.parse(await data.text())).toEqual({ city: 'Yaoundé', supportingDocuments: [] });
    update.flush(
      ok(
        fakeJobApplication({
          city: 'Yaoundé',
          supportingDocuments: [],
          supportingDocumentUrls: [],
        }),
      ),
    );
    await fixture.whenStable();
    expect(el.querySelector('app-apply-form')).toBeNull();
    expect(el.textContent).toContain('Your application was updated.');
    expect(el.textContent).toContain('Yaoundé');
  });

  it('locks editing once the team is reviewing it', async () => {
    localStorage.setItem(storageKey, 'app-1');
    const { fixture, el } = await render();
    backend
      .expectOne(`${api}/app-1`)
      .flush(
        ok(fakeJobApplication({ status: ApplicationStatus.SHORTLISTED, reviewNote: 'Strong CV' })),
      );
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    backend.expectOne(`${environment.apiUrl}/job-listing/job-1`).flush(ok(fakeJobListing()));
    await fixture.whenStable();
    expect(el.textContent).toContain('Shortlisted');
    expect(el.textContent).toContain('Strong CV');
    expect(el.textContent).not.toContain('Edit application');
  });

  it('forgets an ID that is no longer theirs', async () => {
    localStorage.setItem(storageKey, 'app-9');
    const { fixture, el } = await render();
    backend
      .expectOne(`${api}/app-9`)
      .flush(
        { status: 404, message: 'Job application not found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(el.textContent).toContain("You haven't applied yet");
  });
});
