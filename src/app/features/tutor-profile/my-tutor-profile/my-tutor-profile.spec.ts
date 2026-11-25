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
import { MyTutorProfile } from './my-tutor-profile';

const api = `${environment.apiUrl}/tutor-profile`;
const storageKey = 'll.tutorProfileId.tut-1';

describe('MyTutorProfile', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(storageKey);
    await TestBed.configureTestingModule({
      imports: [MyTutorProfile],
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
    localStorage.removeItem(storageKey);
  });

  async function render(role: UserRole = UserRole.LECTURER, email = 'chidi@example.com') {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'tut-1', role, email }));
    const fixture = TestBed.createComponent(MyTutorProfile);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () =>
      el.querySelector('app-tutor-profile-form form')!.dispatchEvent(new Event('submit'));
    return { fixture, el, notified, button, type, submit };
  }

  it('creates the profile, shows it and remembers its ID', async () => {
    const { fixture, el, notified, button, type, submit } = await render();
    expect(el.textContent).toContain('Set up your tutor profile');

    button('Create my profile')!.click();
    await fixture.whenStable();
    submit();
    fixture.detectChanges();
    expect(el.textContent).toContain('First name is required.');

    type('tp-firstName', 'Chidi');
    type('tp-lastName', 'Eze');
    type('tp-subjects', 'Calculus, Linear Algebra , ');
    type('tp-yearsOfExperience', '8');
    type('tp-hourlyRate', '25');
    submit();
    fixture.detectChanges();
    expect(el.textContent).toContain('Add the currency for your hourly rate');

    type('tp-currency', 'usd');
    submit();
    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({
      firstName: 'Chidi',
      lastName: 'Eze',
      subjects: ['Calculus', 'Linear Algebra'],
      yearsOfExperience: 8,
      hourlyRate: 25,
      currency: 'USD',
    });
    req.flush(ok(fakeTutorProfile(), 'Your tutor profile has been created successfully.'));
    await fixture.whenStable();

    const details = el.querySelector('app-tutor-profile-details')!;
    expect(details.textContent).toContain('Dr. Chidi Eze');
    expect(details.textContent).toContain('25.00 USD / hour');
    expect(notified).toEqual(['Your tutor profile has been created successfully.']);
    expect(localStorage.getItem(storageKey)).toBe('tp-1');
  });

  it('checks experience and rate formats', async () => {
    const { fixture, el, button, type, submit } = await render();
    button('Create my profile')!.click();
    await fixture.whenStable();
    type('tp-firstName', 'Chidi');
    type('tp-lastName', 'Eze');
    type('tp-yearsOfExperience', '61');
    type('tp-hourlyRate', '12.345');
    submit();
    fixture.detectChanges();
    expect(el.textContent).toContain('Years of experience must be at most 60.');
    expect(el.textContent).toContain('Hourly rate can have at most 8 digits and 2 decimals.');
  });

  it('updates a remembered profile with only the filled-in fields', async () => {
    localStorage.setItem(storageKey, 'tp-1');
    const { fixture, el, button, type, submit } = await render();
    expect(el.textContent).toContain('Your tutor profile is saved');

    button('Edit my profile')!.click();
    await fixture.whenStable();
    type('tp-city', 'Buea');
    submit();

    const req = backend.expectOne(`${api}/tp-1`);
    expect(req.request.method).toBe('PATCH');
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ city: 'Buea' });
    req.flush(ok(fakeTutorProfile({ city: 'Buea' }), 'Tutor profile updated successfully.'));
    await fixture.whenStable();
    expect(el.querySelector('app-tutor-profile-details')?.textContent).toContain('Buea');
  });

  it('deletes the profile and forgets its ID', async () => {
    localStorage.setItem(storageKey, 'tp-1');
    const { fixture, el, notified, button } = await render();
    button('Delete my profile')!.click();
    await fixture.whenStable();
    button('Delete profile')!.click();
    backend.expectOne(`${api}/tp-1`).flush(ok(null, 'Tutor profile deleted successfully.'));
    await fixture.whenStable();

    expect(el.textContent).toContain('Set up your tutor profile');
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(notified).toEqual(['Tutor profile deleted successfully.']);
  });

  it('finds and shows a super admin their own profile by email', async () => {
    const { fixture, el } = await render(UserRole.SUPER_ADMIN);
    const search = backend.expectOne((r) => r.url === `${api}/search`);
    expect(search.request.params.get('search')).toBe('chidi@example.com');
    search.flush(
      ok(
        coursePage([
          fakeTutorSummary({ id: 'other', email: 'chidi.other@example.com' }),
          fakeTutorSummary(),
        ]),
      ),
    );
    backend.expectOne(`${api}/tp-1`).flush(ok(fakeTutorProfile()));
    await fixture.whenStable();

    expect(el.querySelector('app-tutor-profile-details')?.textContent).toContain('Calculus');
    expect(localStorage.getItem(storageKey)).toBe('tp-1');
  });
});
