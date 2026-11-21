import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { AuthService } from '../auth.service';
import { VerifyOtp } from './verify-otp';

const api = `${environment.apiUrl}/auth`;

describe('VerifyOtp', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [VerifyOtp],
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
    const fixture = TestBed.createComponent(VerifyOtp);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    };
    const submit = async (index = 0) => {
      el.querySelectorAll('form')[index].dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, type, submit };
  }

  it('requires exactly 6 digits and strips anything else', async () => {
    const { el, type, submit } = await render();
    type('#otpCode', '12a3');
    expect(el.querySelector<HTMLInputElement>('#otpCode')?.value).toBe('123');
    await submit();
    expect(el.querySelector('#otpCode-error')?.textContent).toContain('Enter the 6 digits');
    expect(el.querySelector('#otpCode-error')?.className).toContain('text-red-600');
    backend.expectNone(`${api}/verify-otp`);
  });

  it('verifies the code and sends the user to log in', async () => {
    const { type, submit } = await render();
    type('#otpCode', '482 913');
    await submit();
    const req = backend.expectOne(`${api}/verify-otp`);
    expect(req.request.body).toEqual({ otpCode: '482913' });
    req.flush({ success: true, status: 200, message: 'Email verified', data: null });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { verified: 'true' } });
  });

  it('shows the API error for a wrong code', async () => {
    const { fixture, el, type, submit } = await render();
    type('#otpCode', '000000');
    await submit();
    backend.expectOne(`${api}/verify-otp`).flush(
      {
        success: false,
        status: 400,
        error: 'Bad Request',
        errorCode: 'BAD_REQUEST',
        message: 'Invalid or expired verification code',
        path: '',
        timestamp: '',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Invalid or expired');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('resends the code to the email from sign-up, then waits before allowing another', async () => {
    TestBed.inject(AuthService).setPendingEmail('amara@example.com');
    const { fixture, el, submit } = await render();
    expect(el.textContent).toContain('amara@example.com');

    await submit(1);
    const req = backend.expectOne(`${api}/resend-otp`);
    expect(req.request.body).toEqual({ email: 'amara@example.com' });
    req.flush({ success: true, status: 200, message: 'A new code is on its way', data: null });
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('A new code is on its way');
    const resendButton = el.querySelectorAll('button[type="submit"]')[1] as HTMLButtonElement;
    expect(resendButton.disabled).toBe(true);
    expect(resendButton.textContent).toContain('Resend code in');
  });

  it('asks for the email when it does not know it', async () => {
    const { el, submit } = await render();
    await submit(1);
    expect(el.querySelector('#resendEmail-error')?.textContent).toContain('Email is required.');
    backend.expectNone(`${api}/resend-otp`);
  });
});
