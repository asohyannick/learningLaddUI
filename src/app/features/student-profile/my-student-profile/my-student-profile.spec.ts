import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { fakeStudentProfile } from '../../../core/testing/fake-student-profile';
import { MyStudentProfile } from './my-student-profile';

const api = `${environment.apiUrl}/student-profile`;
const storageKey = 'll.studentProfileId.stu-1';

describe('MyStudentProfile', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(storageKey);
    await TestBed.configureTestingModule({
      imports: [MyStudentProfile],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'stu-1', role: UserRole.STUDENT }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
    localStorage.removeItem(storageKey);
  });

  async function render() {
    const fixture = TestBed.createComponent(MyStudentProfile);
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
    return { fixture, el, notified, button, type };
  }

  it('creates the profile, shows it and remembers its ID', async () => {
    const { fixture, el, notified, button, type } = await render();
    expect(el.textContent).toContain('Set up your student profile');

    button('Create my profile')!.click();
    await fixture.whenStable();
    el.querySelector('app-student-profile-form form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.textContent).toContain('First name is required.');

    type('sp-firstName', 'Amara');
    type('sp-lastName', 'Okafor');
    type('sp-hobbies', 'Chess, Football , ');
    el.querySelector('app-student-profile-form form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({
      firstName: 'Amara',
      lastName: 'Okafor',
      hobbies: ['Chess', 'Football'],
    });
    req.flush(ok(fakeStudentProfile(), 'Your student profile has been created successfully.'));
    await fixture.whenStable();

    expect(el.querySelector('app-student-profile-details')?.textContent).toContain('Amara Okafor');
    expect(notified).toEqual(['Your student profile has been created successfully.']);
    expect(localStorage.getItem(storageKey)).toBe('sp-1');
  });

  it('updates a remembered profile with only the filled-in fields', async () => {
    localStorage.setItem(storageKey, 'sp-1');
    const { fixture, el, button, type } = await render();
    expect(el.textContent).toContain('Your student profile is saved');

    button('Edit my profile')!.click();
    await fixture.whenStable();
    type('sp-city', 'Buea');
    el.querySelector('app-student-profile-form form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne(`${api}/sp-1`);
    expect(req.request.method).toBe('PATCH');
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ city: 'Buea' });
    req.flush(ok(fakeStudentProfile({ city: 'Buea' }), 'Student profile updated successfully.'));
    await fixture.whenStable();
    expect(el.querySelector('app-student-profile-details')?.textContent).toContain('Buea');
  });

  it('deletes the profile and forgets its ID', async () => {
    localStorage.setItem(storageKey, 'sp-1');
    const { fixture, el, notified, button } = await render();
    button('Delete my profile')!.click();
    await fixture.whenStable();
    button('Delete profile')!.click();
    backend.expectOne(`${api}/sp-1`).flush(ok(null, 'Student profile deleted successfully.'));
    await fixture.whenStable();

    expect(el.textContent).toContain('Set up your student profile');
    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(notified).toEqual(['Student profile deleted successfully.']);
  });
});
