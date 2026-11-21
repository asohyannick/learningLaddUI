import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../interceptor/error.interceptor';
import { fakeLoginResponse, ok } from '../../testing/fake-login-response';
import { AuthService } from './auth.service';

const api = `${environment.apiUrl}/auth`;

function tokens(accessToken: string, refreshToken: string) {
  return {
    accessToken,
    accessTokenExpiresIn: 300,
    accessTokenExpiresAt: '',
    refreshToken,
    refreshTokenExpiresIn: 604800,
    refreshTokenExpiresAt: '',
    tokenType: 'Bearer',
  };
}

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('keeps the refresh token and profile, but never the access token, in storage', () => {
    auth.startSession(fakeLoginResponse());
    expect(localStorage.getItem('ll.refreshToken')).toBe('refresh-1');
    expect(localStorage.getItem('ll.user')).toContain('Amara');
    expect(JSON.stringify({ ...localStorage })).not.toContain('access-1');
    expect(auth.accessToken()).toBe('access-1');
    expect(auth.dashboardPath()).toBe('/dashboard/student');
  });

  it('renews the access token in the background a minute before it expires', () => {
    auth.startSession(fakeLoginResponse());

    vi.advanceTimersByTime(239_000);
    backend.expectNone(`${api}/refresh-token`);

    vi.advanceTimersByTime(1_000);
    const req = backend.expectOne(`${api}/refresh-token`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(ok(tokens('access-2', 'refresh-2')));

    expect(auth.accessToken()).toBe('access-2');
    expect(localStorage.getItem('ll.refreshToken')).toBe('refresh-2');

    // ...and keeps doing so with the rotated token.
    vi.advanceTimersByTime(240_000);
    expect(backend.expectOne(`${api}/refresh-token`).request.body).toEqual({
      refreshToken: 'refresh-2',
    });
  });

  it('gets a new access token at start-up after a reload', () => {
    localStorage.setItem('ll.refreshToken', 'saved');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fresh = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);

    fresh.restoreSession();
    backend.expectOne(`${api}/refresh-token`).flush(ok(tokens('access-9', 'refresh-9')));
    expect(fresh.accessToken()).toBe('access-9');
  });

  it('retries later when the server is unreachable, without signing out', () => {
    auth.startSession(fakeLoginResponse());
    vi.advanceTimersByTime(240_000);
    backend
      .expectOne(`${api}/refresh-token`)
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });

    expect(auth.isAuthenticated()).toBe(true);
    vi.advanceTimersByTime(30_000);
    backend.expectOne(`${api}/refresh-token`).flush(ok(tokens('access-2', 'refresh-2')));
    expect(auth.accessToken()).toBe('access-2');
  });

  it('signs out and asks to log in again when the refresh token is rejected', () => {
    auth.startSession(fakeLoginResponse());
    vi.advanceTimersByTime(240_000);
    backend
      .expectOne(`${api}/refresh-token`)
      .flush(
        { success: false, status: 400, message: 'Refresh token revoked', path: '', timestamp: '' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ll.refreshToken')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 'true' } });
  });

  it('uses the newest refresh token written by another tab', () => {
    auth.startSession(fakeLoginResponse());
    localStorage.setItem('ll.refreshToken', 'from-other-tab');
    window.dispatchEvent(new StorageEvent('storage', { key: 'll.refreshToken' }));

    auth.refreshAccessToken().subscribe();
    expect(backend.expectOne(`${api}/refresh-token`).request.body).toEqual({
      refreshToken: 'from-other-tab',
    });
  });

  it('signs out here when another tab signs out', () => {
    auth.startSession(fakeLoginResponse());
    localStorage.removeItem('ll.refreshToken');
    window.dispatchEvent(new StorageEvent('storage', { key: 'll.refreshToken' }));

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { signedOut: 'true' } });
  });

  it('revokes the refresh token on logout and clears the session even if that fails', () => {
    auth.startSession(fakeLoginResponse());
    let done = false;
    auth.logout().subscribe({ complete: () => (done = true) });

    const req = backend.expectOne(`${api}/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush({ success: false, status: 500, message: 'x' }, { status: 500, statusText: 'Error' });

    expect(done).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.accessToken()).toBeNull();
    expect(localStorage.getItem('ll.user')).toBeNull();

    vi.advanceTimersByTime(600_000);
    backend.expectNone(`${api}/refresh-token`); // the renewal timer is gone too
  });

  it('sends the reset token as a query param and clears any local session', () => {
    auth.startSession(fakeLoginResponse());
    auth
      .resetPassword('tok-123', { newPassword: 'Secret#123', confirmPassword: 'Secret#123' })
      .subscribe();

    const req = backend.expectOne((r) => r.url === `${api}/reset-password`);
    expect(req.request.params.get('token')).toBe('tok-123');
    expect(req.request.body).toEqual({ newPassword: 'Secret#123', confirmPassword: 'Secret#123' });
    req.flush(ok(null, 'Password changed'));
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('signs in with a Firebase ID token', () => {
    auth.loginWithGoogle('firebase-id-token').subscribe();
    const req = backend.expectOne(`${api}/google`);
    expect(req.request.body).toEqual({ idToken: 'firebase-id-token' });
    req.flush(ok(fakeLoginResponse({ refreshToken: 'google-refresh' })));
    expect(localStorage.getItem('ll.refreshToken')).toBe('google-refresh');
  });
});
