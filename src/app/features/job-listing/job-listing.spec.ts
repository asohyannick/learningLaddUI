import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/service/auth/auth.service';
import { JobListing } from './job-listing';

describe('JobListing', () => {
  const isAuthenticated = signal(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobListing],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated, dashboardPath: signal('/dashboard/student') },
        },
      ],
    }).compileComponents();
  });

  it('asks guests to sign in and come back to /jobs', async () => {
    isAuthenticated.set(false);
    const fixture = TestBed.createComponent(JobListing);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sign in to see open roles');
    // The header has its own plain "Sign in" link; the page's link brings the user back here.
    const hrefs = Array.from(el.querySelectorAll('a[href]'), (a) => a.getAttribute('href'));
    expect(hrefs).toContain('/login?returnUrl=%2Fjobs');
  });

  it('shows the open roles area to signed-in users', async () => {
    isAuthenticated.set(true);
    const fixture = TestBed.createComponent(JobListing);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Open roles are on their way',
    );
  });
});
