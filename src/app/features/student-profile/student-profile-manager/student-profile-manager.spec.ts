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
import { fakeStudentProfile, fakeStudentSummary } from '../../../core/testing/fake-student-profile';
import { StudentProfileManager } from './student-profile-manager';

const api = `${environment.apiUrl}/student-profile`;
const listUrl = `${api}?page=0&size=20`;

describe('StudentProfileManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentProfileManager],
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
    const fixture = TestBed.createComponent(StudentProfileManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(57));
    backend.expectOne(listUrl).flush(ok(coursePage([fakeStudentSummary()], 57)));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    return { fixture, el, notified, button };
  }

  it('lists profiles with the total count; admins can edit and delete', async () => {
    const { el } = await render(UserRole.SUPER_ADMIN);
    expect(el.querySelector('[data-testid="profile-count"]')?.textContent?.trim()).toBe('57');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Amara Okafor');
    expect(row).toContain('LL-2026-0001');
    expect(row).toContain('Active');
    expect(el.querySelector('button[aria-label="Edit Amara Okafor"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Delete Amara Okafor"]')).not.toBeNull();
  });

  it('is read-only for registrars', async () => {
    const { el } = await render(UserRole.REGISTRAR);
    expect(el.querySelector('button[aria-label="Edit Amara Okafor"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Delete Amara Okafor"]')).toBeNull();
    expect(el.querySelector('button[aria-label="Download Amara Okafor as PDF"]')).not.toBeNull();
  });

  it('searches with filters on the search endpoint', async () => {
    const { fixture, el } = await render(UserRole.ADMIN);
    const status = el.querySelectorAll('select')[0] as HTMLSelectElement;
    status.value = 'GRADUATED';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    // The status filter applies at once; the keyword waits for the user to pause.
    const byStatus = backend.expectOne((r) => r.url === `${api}/search`);
    expect(byStatus.request.params.get('enrollmentStatus')).toBe('GRADUATED');
    byStatus.flush(ok(coursePage([fakeStudentSummary()])));

    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'okafor';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('search')).toBe('okafor');
    expect(req.request.params.get('enrollmentStatus')).toBe('GRADUATED');
    req.flush(ok(coursePage([])));
    await fixture.whenStable();
    expect(el.querySelector('tbody')?.textContent).toContain('No student profiles match');
  });

  it('opens a profile in the side panel', async () => {
    const { fixture, el } = await render(UserRole.REGISTRAR);
    el.querySelector<HTMLButtonElement>('button[aria-label="View Amara Okafor"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/sp-1`).flush(ok(fakeStudentProfile({ city: 'Douala' })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-student-profile')!;
    expect(panel.textContent).toContain('Douala');
    expect(panel.textContent).toContain('Chess');
    expect(panel.textContent).toContain('Download PDF');
    expect(panel.textContent).not.toContain('Edit profile');
  });

  it('edits a profile, sending only the changed fields', async () => {
    const { fixture, el, notified } = await render(UserRole.ADMIN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Amara Okafor"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/sp-1`).flush(ok(fakeStudentProfile()));
    await fixture.whenStable();

    const city = el.querySelector<HTMLInputElement>('#sp-city')!;
    expect(city.value).toBe('Douala');
    city.value = 'Yaoundé';
    city.dispatchEvent(new Event('input'));
    el.querySelector('app-student-profile-form form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne((r) => r.method === 'PATCH');
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ city: 'Yaoundé' });
    req.flush(ok(fakeStudentProfile({ city: 'Yaoundé' }), 'Student profile updated successfully.'));

    backend.expectOne(listUrl).flush(ok(coursePage([fakeStudentSummary()], 57)));
    backend.expectOne(`${api}/count`).flush(ok(57));
    await fixture.whenStable();
    expect(el.querySelector('app-student-profile-form')).toBeNull();
    expect(notified).toEqual(['Student profile updated successfully.']);
  });

  it('deletes a profile after confirming', async () => {
    const { fixture, el, notified, button } = await render(UserRole.ADMIN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Amara Okafor"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-student-profile')?.textContent).toContain('Amara Okafor');

    button('Delete profile')!.click();
    const req = backend.expectOne(`${api}/sp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(ok(null, 'Student profile deleted successfully.'));

    backend.expectOne(listUrl).flush(ok(coursePage([])));
    backend.expectOne(`${api}/count`).flush(ok(56));
    await fixture.whenStable();
    expect(notified).toEqual(['Student profile deleted successfully.']);
  });
});
