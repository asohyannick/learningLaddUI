import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourseSummary } from '../../../core/testing/fake-course';
import { fakeJobSummary, jobPage } from '../../../core/testing/fake-job-listing';
import { fakePartner } from '../../../core/testing/fake-partner';
import { fakeStudentSummary } from '../../../core/testing/fake-student-profile';
import { fakeTimeTable, timeTablePage } from '../../../core/testing/fake-time-table';
import { fakeTutorSummary } from '../../../core/testing/fake-tutor-profile';
import { fakeUser } from '../../../core/testing/fake-user';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { AdminDashboard } from './admin-dashboard';

const api = `${environment.apiUrl}/auth/users`;

describe('AdminDashboard', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'me', firstName: 'Ngozi', role: UserRole.ADMIN }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === api)
      .flush(
        ok({
          content: [fakeUser({ id: 'u-1', firstName: 'Ada' })],
          totalElements: 1,
          totalPages: 1,
        }),
      );
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('greets the admin, lists users and links to sign out', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('Welcome back, Ngozi');
    expect(el.querySelector('tbody')?.textContent).toContain('Ada Ade');
    expect(el.querySelector('a[href="/logout"]')).not.toBeNull();
  });

  it('opens the user panel, then the block dialog, and confirms with a toast', async () => {
    const { fixture, el } = await render();

    el.querySelector<HTMLButtonElement>('button[aria-label="View Ada Ade"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/u-1`).flush(ok(fakeUser({ id: 'u-1', firstName: 'Ada' })));
    await fixture.whenStable();
    expect(el.querySelector('app-fetch-user')?.textContent).toContain('User details');

    el.querySelector<HTMLButtonElement>('app-fetch-user footer button')!.click();
    await fixture.whenStable();
    const reason = el.querySelector<HTMLTextAreaElement>('#block-reason')!;
    reason.value = 'Repeated spam';
    reason.dispatchEvent(new Event('input'));
    el.querySelector('app-block-user-account form')!.dispatchEvent(new Event('submit'));
    backend.expectOne(`${api}/u-1/block`).flush(ok(null, 'User account blocked'));
    await fixture.whenStable();

    expect(el.querySelector('app-block-user-account')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('User account blocked');
    expect(el.querySelector('tbody')?.textContent).toContain('Blocked');
  });

  it('shows the course tools in the Courses section', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'courses');
    fixture.detectChanges();
    const courses = `${environment.apiUrl}/course`;
    backend.expectOne(`${courses}/count`).flush(ok(3));
    backend.expectOne(`${courses}?page=0&size=20`).flush(ok(coursePage([fakeCourseSummary()])));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Courses');
    expect(el.querySelector('a[aria-current="page"]')?.textContent).toContain('Courses');
    expect(el.querySelector('tbody')?.textContent).toContain('Data Science 101');
    expect(el.querySelector('button[aria-label="Delete Data Science 101"]')).not.toBeNull();
  });

  it('shows the student profiles in the Students section', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'students');
    fixture.detectChanges();
    const profiles = `${environment.apiUrl}/student-profile`;
    backend.expectOne(`${profiles}/count`).flush(ok(8));
    backend
      .expectOne(`${profiles}?page=0&size=20`)
      .flush(ok(coursePage([fakeStudentSummary()], 8)));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Student profiles');
    expect(el.querySelector('[data-testid="profile-count"]')?.textContent?.trim()).toBe('8');
    expect(el.querySelector('button[aria-label="Delete Amara Okafor"]')).not.toBeNull();
  });

  it('opens the delete-account dialog from the sidebar', async () => {
    const { fixture, el } = await render();
    const button = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Delete my account'),
    )!;
    button.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-user-account #delete-password')).not.toBeNull();
  });

  it('shows the tutor profiles in the Tutors section', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'tutors');
    fixture.detectChanges();
    const profiles = `${environment.apiUrl}/tutor-profile`;
    backend.expectOne(`${profiles}/count`).flush(ok(4));
    backend.expectOne(`${profiles}?page=0&size=20`).flush(ok(coursePage([fakeTutorSummary()], 4)));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Tutor profiles');
    expect(el.querySelector('[data-testid="profile-count"]')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('button[aria-label="Delete Dr. Chidi Eze"]')).not.toBeNull();
  });

  it('manages partners and sponsors in the Partners section', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'partners');
    fixture.detectChanges();
    const partners = `${environment.apiUrl}/partners`;
    backend.expectOne(`${partners}/count`).flush(ok(3));
    backend.expectOne(`${partners}?page=0&size=20`).flush(ok(coursePage([fakePartner()], 3)));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Partners & sponsors');
    const links = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(links).toContain('Partners');
    expect(el.querySelector('[data-testid="partner-count"]')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('button[aria-label="Edit Orange Foundation"]')).not.toBeNull();
    expect(
      [...el.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Add partner'),
    ).toBe(true);
  });

  it('manages the timetable in the Timetable section, with Delete for admins', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'timetable');
    fixture.detectChanges();
    const timetable = `${environment.apiUrl}/time-table`;
    backend.expectOne(`${timetable}/count`).flush(5);
    backend.expectOne(`${timetable}?page=0&size=20`).flush(timeTablePage([fakeTimeTable()], 5));
    TestBed.tick();
    backend
      .expectOne((r) => r.url === `${environment.apiUrl}/course/search`)
      .flush(ok(coursePage([fakeCourseSummary()])));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Timetable');
    expect(el.querySelector('[data-testid="timetable-count"]')?.textContent?.trim()).toBe('5');
    expect(el.querySelector('button[aria-label="Delete Weekly lecture"]')).not.toBeNull();
  });

  it('manages job listings in the Job listings section', async () => {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.componentRef.setInput('section', 'jobs');
    fixture.detectChanges();
    const jobs = `${environment.apiUrl}/job-listing`;
    backend.expectOne(`${jobs}/count`).flush(ok(4));
    backend.expectOne(`${jobs}?page=0&size=20`).flush(jobPage([fakeJobSummary()], 4));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Job listings');
    expect(el.querySelector('[data-testid="job-count"]')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('tbody')?.textContent).toContain('JOB-2026-0042');
    expect(el.querySelector('button[aria-label="Delete Lecturer in Mathematics"]')).not.toBeNull();
  });
});
