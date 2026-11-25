import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { AuthService } from '../auth.service';
import { Register } from './register';

const url = `${environment.apiUrl}/auth/register`;

describe('Register', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(Register);
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
    const errorFor = (id: string) => el.querySelector(`#${id}-error`)?.textContent?.trim();
    return { fixture, el, type, submit, errorFor };
  }

  it('validates every field on the client and sends nothing', async () => {
    const { el, type, submit, errorFor } = await render();
    type('#firstName', '1A');
    type('#lastName', 'B');
    type('#email', 'amara@');
    type('#password', 'weakpass');
    type('#confirmPassword', 'different');
    await submit();

    expect(errorFor('firstName')).toContain('must start with a letter');
    expect(errorFor('lastName')).toContain('at least 2 characters');
    expect(errorFor('email')).toContain('valid email');
    expect(errorFor('confirmPassword')).toBe('Passwords do not match.');
    expect(el.textContent).toContain('Password does not meet all the requirements');
    expect(el.querySelector('#password-rules .text-red-600')?.textContent).toContain(
      'An uppercase letter',
    );
    expect(el.querySelector('#firstName')?.className).toContain('border-red-500');
    backend.expectNone(url);
  });

  it('registers, remembers the email and moves on to the code step', async () => {
    const { type, submit } = await render();
    type('#firstName', ' Amara ');
    type('#lastName', "N'Diaye");
    type('#email', 'amara@example.com');
    type('#password', 'Secret#123');
    type('#confirmPassword', 'Secret#123');
    await submit();

    const req = backend.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      firstName: 'Amara',
      lastName: "N'Diaye",
      email: 'amara@example.com',
      password: 'Secret#123',
    });
    req.flush({ success: true, status: 201, message: 'Account created', data: null });

    expect(TestBed.inject(AuthService).pendingEmail()).toBe('amara@example.com');
    expect(navigate).toHaveBeenCalledWith(['/verify-otp']);
  });

  it('shows API field errors next to the matching input', async () => {
    const { fixture, el, type, submit, errorFor } = await render();
    type('#firstName', 'Amara');
    type('#lastName', 'Diaye');
    type('#email', 'amara@example.com');
    type('#password', 'Secret#123');
    type('#confirmPassword', 'Secret#123');
    await submit();
    backend.expectOne(url).flush(
      {
        success: false,
        status: 400,
        error: 'Bad Request',
        errorCode: 'BAD_REQUEST',
        message: 'An account with this email already exists',
        errors: [{ field: 'email', message: 'This email is already registered' }],
        path: '',
        timestamp: '',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('already exists');
    expect(el.querySelector('[role="alert"] a')?.getAttribute('href')).toBe('/login');
    expect(errorFor('email')).toBe('This email is already registered');
    expect(navigate).not.toHaveBeenCalled();
  });
});
