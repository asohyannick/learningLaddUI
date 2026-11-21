import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { LoginViaMagicLink } from './login-via-magic-link';

const api = `${environment.apiUrl}/auth/magic-link`;

describe('LoginViaMagicLink', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginViaMagicLink],
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
    const fixture = TestBed.createComponent(LoginViaMagicLink);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const typeEmail = (value: string) => {
      const input = el.querySelector<HTMLInputElement>('#email')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, typeEmail, submit };
  }

  it('checks the email before sending', async () => {
    const { el, typeEmail, submit } = await render();
    typeEmail('not-an-email');
    await submit();
    expect(el.querySelector('#email-error')?.textContent).toContain('valid email');
    backend.expectNone(`${api}/send`);
  });

  it('sends the link and shows where it went, with a resend button on cooldown', async () => {
    const { fixture, el, typeEmail, submit } = await render();
    typeEmail('  ada@example.com ');
    await submit();

    const req = backend.expectOne(`${api}/send`);
    expect(req.request.body).toEqual({ email: 'ada@example.com' });
    req.flush(ok(null, 'Magic link sent'));
    await fixture.whenStable();

    expect(el.querySelector('[role="status"]')?.textContent).toContain('Magic link sent');
    expect(el.textContent).toContain('ada@example.com');
    const resend = el.querySelector<HTMLButtonElement>('app-resend-magic-link button')!;
    expect(resend.disabled).toBe(true);
    expect(resend.textContent).toContain('Send another link in 60s');
  });

  it('shows the API error message (the backend omits `success`)', async () => {
    const { el, typeEmail, submit } = await render();
    typeEmail('blocked@example.com');
    await submit();
    backend.expectOne(`${api}/send`).flush(
      {
        message: 'Account is not verified',
        status: 400,
        errorCode: 'BAD_REQUEST',
        path: '/api/v1/auth/magic-link/send',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    TestBed.tick();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Account is not verified');
  });
});
