import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/service/auth/auth.service';
import { fakeJobSummary, jobPage } from '../../core/testing/fake-job-listing';
import { JobListing } from './job-listing';

const searchUrl = `${environment.apiUrl}/job-listing/search`;

describe('JobListing', () => {
  const isAuthenticated = signal(false);
  let isAdmin = false;
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobListing],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated,
            role: signal(null),
            hasAnyRole: () => isAdmin,
            dashboardPath: signal('/dashboard/student'),
          },
        },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('asks guests to sign in and come back to /jobs, without calling the API', async () => {
    isAuthenticated.set(false);
    const fixture = TestBed.createComponent(JobListing);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sign in to see open roles');
    const hrefs = Array.from(el.querySelectorAll('a[href]'), (a) => a.getAttribute('href'));
    expect(hrefs).toContain('/login?returnUrl=%2Fjobs');
    backend.expectNone((r) => r.url === searchUrl);
  });

  it('lists open roles for signed-in users and filters them', async () => {
    isAuthenticated.set(true);
    const fixture = TestBed.createComponent(JobListing);
    fixture.detectChanges();
    const first = backend.expectOne((r) => r.url === searchUrl);
    expect(first.request.params.get('openOnly')).toBe('true');
    expect(first.request.params.get('size')).toBe('12');
    first.flush(jobPage([fakeJobSummary()]));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('1 role taking applications');
    expect(el.querySelector('app-job-card')?.textContent).toContain('Lecturer in Mathematics');
    expect(el.querySelector('a[href="/jobs/job-1"]')).not.toBeNull();

    const type = el.querySelector('select')!;
    type.value = 'PART_TIME';
    type.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const filtered = backend.expectOne((r) => r.url === searchUrl);
    expect(filtered.request.params.get('employmentType')).toBe('PART_TIME');
    expect(filtered.request.params.get('openOnly')).toBe('true');
    filtered.flush(jobPage([]));
    await fixture.whenStable();
    expect(el.textContent).toContain('No roles match your search');
  });

  it('tells admins that drafts are hidden when there are no open roles', async () => {
    isAuthenticated.set(true);
    isAdmin = true;
    const fixture = TestBed.createComponent(JobListing);
    fixture.detectChanges();
    backend.expectOne((r) => r.url === searchUrl).flush(jobPage([]));
    await fixture.whenStable();
    const hint = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="drafts-hint"]',
    );
    expect(hint?.textContent).toContain('New listings start as drafts');
    expect(hint?.querySelector('a')?.getAttribute('href')).toBe('/dashboard/admin?section=jobs');
    isAdmin = false;
  });
});
