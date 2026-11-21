import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { UserRole } from '../../../enum/global-enum-configuration';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { fakeLoginResponse, ok } from '../../../testing/fake-login-response';
import { AuthService } from '../auth.service';
import { VerifyMagicLink } from './verify-magic-link';

const url = `${environment.apiUrl}/auth/magic-link/verify`;

describe('VerifyMagicLink', () => {
  let backend: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifyMagicLink],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render(inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(VerifyMagicLink);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('signs in with the token and opens the dashboard for the role', async () => {
    const { el } = await render({ token: 'tok-123' });
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Signing you in');

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('POST');
    expect(req.request.params.get('verifyMagicLinkTokenDto')).toBe('tok-123');
    req.flush(ok(fakeLoginResponse({ role: UserRole.ADMIN })));

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard/admin', { replaceUrl: true });
  });

  it('accepts the token as `magicLinkToken` too', async () => {
    await render({ magicLinkToken: 'tok-9' });
    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('verifyMagicLinkTokenDto')).toBe('tok-9');
    req.flush(ok(fakeLoginResponse()));
  });

  it('explains when the link has no token, without calling the API', async () => {
    const { el } = await render();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('missing its token');
    expect(el.querySelector('a[href="/magic-link"]')).not.toBeNull();
    backend.expectNone((r) => r.url === url);
  });

  it('shows why an expired or used link was refused', async () => {
    const { fixture, el } = await render({ token: 'used' });
    backend
      .expectOne((r) => r.url === url)
      .flush(
        { message: 'Invalid or expired magic link', status: 400, errorCode: 'BAD_REQUEST' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Invalid or expired magic link',
    );
    expect(el.querySelector('a[href="/magic-link"]')?.textContent).toContain('new link');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
