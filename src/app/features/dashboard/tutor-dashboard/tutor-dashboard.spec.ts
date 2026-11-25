import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourseSummary } from '../../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeTutorSummary } from '../../../core/testing/fake-tutor-profile';
import { TutorDashboard } from './tutor-dashboard';

const api = `${environment.apiUrl}/course`;

describe('TutorDashboard', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ firstName: 'Chidi', role: UserRole.PROFESSOR }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  it('greets the tutor, shows their courses and links to sign out', async () => {
    const fixture = TestBed.createComponent(TutorDashboard);
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(1));
    backend.expectOne(`${api}?page=0&size=20`).flush(ok(coursePage([fakeCourseSummary()])));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('My courses');
    expect(el.textContent).toContain('Welcome back, Chidi');
    expect(el.textContent).toContain('Tutor console');
    expect(el.querySelector('tbody')?.textContent).toContain('Data Science 101');
    expect(el.querySelector('a[href="/logout"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Delete my account');
  });

  it('lets the tutor set up their own profile in the My profile section', async () => {
    const fixture = TestBed.createComponent(TutorDashboard);
    fixture.componentRef.setInput('section', 'profile');
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('My tutor profile');
    expect(el.textContent).toContain('Set up your tutor profile');
    expect([...el.querySelectorAll('a')].map((a) => a.textContent?.trim())).not.toContain('Tutors');
    expect(el.querySelector('app-tutor-profile-manager')).toBeNull();
  });

  it('shows super admins the tutor directory', async () => {
    const auth = TestBed.inject(AuthService);
    auth.endSession();
    auth.startSession(fakeLoginResponse({ role: UserRole.SUPER_ADMIN }));
    const fixture = TestBed.createComponent(TutorDashboard);
    fixture.componentRef.setInput('section', 'tutors');
    fixture.detectChanges();
    const profiles = `${environment.apiUrl}/tutor-profile`;
    backend.expectOne(`${profiles}/count`).flush(ok(3));
    backend.expectOne(`${profiles}?page=0&size=20`).flush(ok(coursePage([fakeTutorSummary()], 3)));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Tutor profiles');
    expect(el.querySelector('[data-testid="profile-count"]')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('button[aria-label="Edit Dr. Chidi Eze"]')).not.toBeNull();
  });
});
