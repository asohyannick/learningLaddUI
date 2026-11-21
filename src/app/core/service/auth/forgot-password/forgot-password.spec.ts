import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { ForgotPassword } from './forgot-password';

const url = `${environment.apiUrl}/auth/forgot-password`;

describe('ForgotPassword', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(ForgotPassword);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (value: string) => {
      const input = el.querySelector<HTMLInputElement>('#email')!;
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

  it('shows a red error for an invalid email and sends nothing', async () => {
    const { el, type, submit } = await render();
    type('not-an-email');
    await submit();
    expect(el.querySelector('#email-error')?.textContent).toContain('valid email');
    expect(el.querySelector('#email-error')?.className).toContain('text-red-600');
    expect(el.querySelector('#email')?.className).toContain('border-red-500');
    backend.expectNone(url);
  });

  it('sends the link and then waits before allowing another', async () => {
    const { fixture, el, type, submit } = await render();
    type('  amara@example.com ');
    await submit();
    const req = backend.expectOne(url);
    expect(req.request.body).toEqual({ email: 'amara@example.com' });
    req.flush(ok(null, 'Reset link sent'));
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Reset link sent');
    expect(el.textContent).toContain('amara@example.com');
    const again = el.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(again.disabled).toBe(true);
    expect(again.textContent).toContain('Send another link in');
  });

  it('shows the API error in red', async () => {
    const { fixture, el, type, submit } = await render();
    type('amara@example.com');
    await submit();
    backend.expectOne(url).flush(
      {
        success: false,
        status: 400,
        error: 'Bad Request',
        errorCode: 'BAD_REQUEST',
        message: 'This account has not been verified yet.',
        path: '',
        timestamp: '',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('not been verified');
    expect(alert?.className).toContain('text-red-700');
  });
});
