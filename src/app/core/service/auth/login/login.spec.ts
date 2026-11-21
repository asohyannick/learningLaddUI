import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { UserRole } from '../../../enum/global-enum-configuration';
import { fakeLoginResponse, ok } from '../../../testing/fake-login-response';
import { AuthService } from '../auth.service';
import { Login } from './login';

const url = `${environment.apiUrl}/auth/login`;

describe('Login', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  async function render(inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(Login);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, type, submit };
  }

  it('shows red errors and sends nothing when the form is invalid', async () => {
    const { el, type, submit } = await render();
    type('#email', 'not-an-email');
    await submit();
    const errors = Array.from(el.querySelectorAll('app-field-error p'), (p) => p.textContent);
    expect(errors.join(' ')).toContain('Enter a valid email address');
    expect(errors.join(' ')).toContain('Password is required.');
    expect(el.querySelector('app-field-error p')?.className).toContain('text-red-600');
    expect(el.querySelector('#email')?.className).toContain('border-red-500');
    expect(el.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
    backend.expectNone(url);
  });

  it('logs in and redirects to the dashboard of the user role', async () => {
    const { type, submit } = await render();
    type('#email', '  amara@example.com ');
    type('#password', 'Secret#123');
    await submit();

    const req = backend.expectOne(url);
    expect(req.request.body).toEqual({ email: 'amara@example.com', password: 'Secret#123' });
    req.flush(ok(fakeLoginResponse({ role: UserRole.LECTURER }), 'Welcome back'));

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/dashboard/tutor', { replaceUrl: true });
  });

  it('goes back to a safe returnUrl, but ignores external ones', async () => {
    const session = ok(fakeLoginResponse());

    let page = await render({ returnUrl: '/library' });
    page.type('#email', 'a@b.co');
    page.type('#password', 'x');
    await page.submit();
    backend.expectOne(url).flush(session);
    expect(navigate).toHaveBeenLastCalledWith('/library', { replaceUrl: true });

    page = await render({ returnUrl: 'https://evil.example' });
    page.type('#email', 'a@b.co');
    page.type('#password', 'x');
    await page.submit();
    backend.expectOne(url).flush(session);
    expect(navigate).toHaveBeenLastCalledWith('/dashboard/student', { replaceUrl: true });
  });

  it('shows the API error and offers verification for unverified accounts', async () => {
    const { fixture, el, type, submit } = await render();
    type('#email', 'amara@example.com');
    type('#password', 'Secret#123');
    await submit();
    backend.expectOne(url).flush(
      {
        success: false,
        status: 400,
        error: 'Bad Request',
        errorCode: 'BAD_REQUEST',
        message: 'Please verify your email with the OTP we sent you before logging in.',
        path: '/api/v1/auth/login',
        timestamp: '',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Please verify your email');
    expect(alert?.textContent).toContain('Verify your email');
    expect(el.querySelector<HTMLInputElement>('#password')?.value).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('confirms a verified email', async () => {
    const { el } = await render({ verified: 'true' });
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Your email is verified');
  });
});
