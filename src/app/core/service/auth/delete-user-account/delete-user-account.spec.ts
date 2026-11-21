import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { fakeLoginResponse, ok } from '../../../testing/fake-login-response';
import { AuthService } from '../auth.service';
import { DeleteUserAccount } from './delete-user-account';

const url = `${environment.apiUrl}/auth/account`;

describe('DeleteUserAccount', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteUserAccount],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'me-1' }));
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render() {
    const fixture = TestBed.createComponent(DeleteUserAccount);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { el, type, submit };
  }

  it('asks for the password first', async () => {
    const { el, submit } = await render();
    await submit();
    expect(el.querySelector('#delete-password-error')?.textContent).toContain(
      'Password is required',
    );
    backend.expectNone((r) => r.url === url);
  });

  it('deletes the account, ends the session and goes to the login page', async () => {
    const { type, submit } = await render();
    type('#delete-password', 'Secret#123');
    type('#delete-reason', ' Leaving the school ');
    await submit();

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('userId')).toBe('me-1');
    expect(req.request.body).toEqual({ password: 'Secret#123', reason: 'Leaving the school' });
    req.flush(ok(null, 'Account deleted'));

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { accountDeleted: 'true' },
      replaceUrl: true,
    });
  });

  it('shows a wrong-password error and clears the field', async () => {
    const { el, type, submit } = await render();
    type('#delete-password', 'wrong');
    await submit();
    backend
      .expectOne((r) => r.url === url)
      .flush(
        { success: false, status: 400, message: 'Incorrect password' },
        { status: 400, statusText: 'Bad Request' },
      );
    TestBed.tick();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Incorrect password');
    expect(el.querySelector<HTMLInputElement>('#delete-password')!.value).toBe('');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
  });
});
