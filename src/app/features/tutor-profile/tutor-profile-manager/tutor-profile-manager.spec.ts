import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage } from '../../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeTutorProfile, fakeTutorSummary } from '../../../core/testing/fake-tutor-profile';
import { TutorProfileManager } from './tutor-profile-manager';

const api = `${environment.apiUrl}/tutor-profile`;
const listUrl = `${api}?page=0&size=20`;

describe('TutorProfileManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorProfileManager],
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

  async function render(role: UserRole) {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'staff', role }));
    const fixture = TestBed.createComponent(TutorProfileManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(12));
    backend.expectOne(listUrl).flush(ok(coursePage([fakeTutorSummary()], 12)));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    return { fixture, el, notified, button };
  }

  it('lists profiles with the total count; admins can edit and delete', async () => {
    const { el } = await render(UserRole.SUPER_ADMIN);
    expect(el.querySelector('[data-testid="profile-count"]')?.textContent?.trim()).toBe('12');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Dr. Chidi Eze');
    expect(row).toContain('TUT-2026-0001');
    expect(row).toContain('Applied Mathematics');
    expect(row).toContain('25.00 USD / hour');
    expect(row).toContain('Active');
    expect(el.querySelector('button[aria-label="Edit Dr. Chidi Eze"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Delete Dr. Chidi Eze"]')).not.toBeNull();
  });

  it('is read-only for students: view and PDF only', async () => {
    const { el } = await render(UserRole.STUDENT);
    expect(el.querySelector('button[aria-label="Edit Dr. Chidi Eze"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Delete Dr. Chidi Eze"]')).toBeNull();
    expect(el.querySelector('button[aria-label="View Dr. Chidi Eze"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Download Dr. Chidi Eze as PDF"]')).not.toBeNull();
  });

  it('searches by status, experience and subject on the search endpoint', async () => {
    const { fixture, el } = await render(UserRole.ADMIN);
    const [status, experience] = [...el.querySelectorAll('select')] as HTMLSelectElement[];
    status.value = 'PENDING_APPROVAL';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const byStatus = backend.expectOne((r) => r.url === `${api}/search`);
    expect(byStatus.request.params.get('status')).toBe('PENDING_APPROVAL');
    byStatus.flush(ok(coursePage([fakeTutorSummary()])));

    experience.value = '5';
    experience.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    backend
      .expectOne((r) => r.params.get('minYearsOfExperience') === '5')
      .flush(ok(coursePage([fakeTutorSummary()])));

    // Typed filters wait for the user to pause.
    const subject = el.querySelector<HTMLInputElement>('input[placeholder^="Subject"]')!;
    subject.value = 'Calculus';
    subject.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('subject')).toBe('Calculus');
    expect(req.request.params.get('status')).toBe('PENDING_APPROVAL');
    expect(req.request.params.get('minYearsOfExperience')).toBe('5');
    req.flush(ok(coursePage([])));
    await fixture.whenStable();
    expect(el.querySelector('tbody')?.textContent).toContain('No tutor profiles match');
  });

  it('opens a profile in the side panel', async () => {
    const { fixture, el } = await render(UserRole.STUDENT);
    el.querySelector<HTMLButtonElement>('button[aria-label="View Dr. Chidi Eze"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/tp-1`).flush(ok(fakeTutorProfile()));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-tutor-profile')!;
    expect(panel.textContent).toContain('Linear Algebra');
    expect(panel.textContent).toContain('PhD Mathematics');
    expect(panel.textContent).toContain('8 years');
    expect(panel.textContent).toContain('Download PDF');
    expect(panel.textContent).not.toContain('Edit profile');
  });

  it('edits a profile, sending only the changed fields', async () => {
    const { fixture, el, notified } = await render(UserRole.ADMIN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Dr. Chidi Eze"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/tp-1`).flush(ok(fakeTutorProfile()));
    await fixture.whenStable();

    const subjects = el.querySelector<HTMLInputElement>('#tp-subjects')!;
    expect(subjects.value).toBe('Calculus, Linear Algebra');
    subjects.value = 'Calculus, Statistics';
    subjects.dispatchEvent(new Event('input'));
    const rate = el.querySelector<HTMLInputElement>('#tp-hourlyRate')!;
    rate.value = '30.50';
    rate.dispatchEvent(new Event('input'));
    el.querySelector('app-tutor-profile-form form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne((r) => r.method === 'PATCH');
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ subjects: ['Calculus', 'Statistics'], hourlyRate: 30.5 });
    req.flush(ok(fakeTutorProfile({ hourlyRate: 30.5 }), 'Tutor profile updated successfully.'));

    backend.expectOne(listUrl).flush(ok(coursePage([fakeTutorSummary()], 12)));
    backend.expectOne(`${api}/count`).flush(ok(12));
    await fixture.whenStable();
    expect(el.querySelector('app-tutor-profile-form')).toBeNull();
    expect(notified).toEqual(['Tutor profile updated successfully.']);
  });

  it('deletes a profile after confirming', async () => {
    const { fixture, el, notified, button } = await render(UserRole.ADMIN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Dr. Chidi Eze"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-tutor-profile')?.textContent).toContain('Dr. Chidi Eze');

    button('Delete profile')!.click();
    const req = backend.expectOne(`${api}/tp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(ok(null, 'Tutor profile deleted successfully.'));

    backend.expectOne(listUrl).flush(ok(coursePage([])));
    backend.expectOne(`${api}/count`).flush(ok(11));
    await fixture.whenStable();
    expect(notified).toEqual(['Tutor profile deleted successfully.']);
  });
});
