import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourse, fakeCourseSummary } from '../../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeTimeTable, timeTablePage } from '../../../core/testing/fake-time-table';
import { fakeTutorSummary } from '../../../core/testing/fake-tutor-profile';
import { StudentDashboard } from './student-dashboard';

const api = `${environment.apiUrl}/course`;

describe('StudentDashboard', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ firstName: 'Amara', role: UserRole.STUDENT }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render() {
    const fixture = TestBed.createComponent(StudentDashboard);
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(4));
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(ok(coursePage([fakeCourseSummary({ id: 'c-1', name: 'Data Science 101' })], 4)));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('greets the student and lists every course with the total count', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('Student portal');
    expect(el.textContent).toContain('Welcome back, Amara');
    expect(el.querySelector('[data-testid="course-count"]')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('tbody')?.textContent).toContain('Data Science 101');
    expect(el.querySelector('a[href="/logout"]')).not.toBeNull();
  });

  it('shows the student their own profile in the My profile section', async () => {
    const fixture = TestBed.createComponent(StudentDashboard);
    fixture.componentRef.setInput('section', 'profile');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('My profile');
    expect(el.querySelector('a[aria-current="page"]')?.textContent).toContain('My profile');
    expect(el.textContent).toContain('Create my profile');
    expect(el.querySelector('app-student-profile-manager')).toBeNull();
  });

  it('is read-only: view and PDF, but no create, edit or delete', async () => {
    const { fixture, el } = await render();
    const text = (b: Element) => b.textContent?.trim();
    expect([...el.querySelectorAll('button')].map(text)).not.toContain('New course');
    expect(el.querySelector('button[aria-label="Edit Data Science 101"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Delete Data Science 101"]')).toBeNull();
    expect(
      el.querySelector('button[aria-label="Download Data Science 101 as PDF"]'),
    ).not.toBeNull();

    el.querySelector<HTMLButtonElement>('button[aria-label="View Data Science 101"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/c-1`).flush(ok(fakeCourse({ description: 'All about data.' })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-course')!;
    expect(panel.textContent).toContain('All about data.');
    expect(panel.textContent).not.toContain('Edit course');
  });

  it('lets the student browse tutors, read-only, in the Find a tutor section', async () => {
    const fixture = TestBed.createComponent(StudentDashboard);
    fixture.componentRef.setInput('section', 'tutors');
    fixture.detectChanges();
    const profiles = `${environment.apiUrl}/tutor-profile`;
    backend.expectOne(`${profiles}/count`).flush(ok(5));
    backend.expectOne(`${profiles}?page=0&size=20`).flush(ok(coursePage([fakeTutorSummary()], 5)));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Find a tutor');
    expect(el.querySelector('tbody')?.textContent).toContain('Dr. Chidi Eze');
    expect(el.querySelector('button[aria-label="View Dr. Chidi Eze"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Edit Dr. Chidi Eze"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Delete Dr. Chidi Eze"]')).toBeNull();
  });

  it('shows the timetable to students without the Delete action', async () => {
    const fixture = TestBed.createComponent(StudentDashboard);
    fixture.componentRef.setInput('section', 'timetable');
    fixture.detectChanges();
    const timetable = `${environment.apiUrl}/time-table`;
    backend.expectOne(`${timetable}/count`).flush(2);
    backend.expectOne(`${timetable}?page=0&size=20`).flush(timeTablePage([fakeTimeTable()], 2));
    TestBed.tick();
    backend
      .expectOne((r) => r.url === `${api}/search`)
      .flush(ok(coursePage([fakeCourseSummary()])));
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Timetable');
    expect(el.querySelector('a[aria-current="page"]')?.textContent).toContain('Timetable');
    expect(el.querySelector('[data-testid="timetable-count"]')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('button[aria-label="Edit Weekly lecture"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Delete Weekly lecture"]')).toBeNull();
  });
});
