import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { ResetPassword } from './reset-password';

const url = `${environment.apiUrl}/auth/reset-password`;

describe('ResetPassword', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
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

  async function render(token?: string) {
    const fixture = TestBed.createComponent(ResetPassword);
    if (token !== undefined) {
      fixture.componentRef.setInput('token', token);
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

  it('explains when the link has no token', async () => {
    const { el } = await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('link is incomplete');
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('a[href="/forgot-password"]')).not.toBeNull();
  });

  it('checks the password rules and the confirmation in red before sending', async () => {
    const { el, type, submit } = await render('tok-1');
    type('#newPassword', 'weak');
    type('#confirmPassword', 'other');
    await submit();

    expect(el.querySelector('#newPassword-error')?.className).toContain('text-red-600');
    expect(el.querySelector('#confirmPassword-error')?.textContent).toContain(
      'Passwords do not match',
    );
    expect(el.querySelector('#password-rules .text-red-600')).not.toBeNull();
    backend.expectNone((r) => r.url === url);
  });

  it('saves the new password and sends the user to sign in', async () => {
    const { type, submit } = await render('tok-1');
    type('#newPassword', 'Secret#123');
    type('#confirmPassword', 'Secret#123');
    await submit();

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('token')).toBe('tok-1');
    expect(req.request.body).toEqual({ newPassword: 'Secret#123', confirmPassword: 'Secret#123' });
    req.flush(ok(null, 'Password changed'));
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { passwordReset: 'true' },
      replaceUrl: true,
    });
  });

  it('offers a new link when the token is refused', async () => {
    const { fixture, el, type, submit } = await render('used');
    type('#newPassword', 'Secret#123');
    type('#confirmPassword', 'Secret#123');
    await submit();
    backend
      .expectOne((r) => r.url === url)
      .flush(
        {
          success: false,
          status: 400,
          error: 'Bad Request',
          errorCode: 'BAD_REQUEST',
          message: 'This reset link is invalid or has expired.',
          path: '',
          timestamp: '',
        },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('invalid or has expired');
    expect(alert?.querySelector('a[href="/forgot-password"]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
