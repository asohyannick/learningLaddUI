import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiErrorResponse } from '../interface';
import { fakeLoginResponse } from '../testing/fake-login-response';
import { AuthService } from '../service/auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

const api = environment.apiUrl;

function session(accessToken: string, refreshToken: string) {
  return fakeLoginResponse({ accessToken, refreshToken });
}

describe('authInterceptor + errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token to API requests only', () => {
    auth.startSession(session('access-1', 'refresh-1'));

    http.get(`${api}/course`).subscribe();
    http.get('https://example.com/data').subscribe();

    expect(backend.expectOne(`${api}/course`).request.headers.get('Authorization')).toBe(
      'Bearer access-1',
    );
    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('refreshes once on parallel 401s, stores the rotated token and retries', () => {
    auth.startSession(session('expired', 'refresh-1'));
    const results: unknown[] = [];

    http.get(`${api}/course`).subscribe((r) => results.push(r));
    http.get(`${api}/booking`).subscribe((r) => results.push(r));
    backend.expectOne(`${api}/course`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${api}/booking`).flush(null, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.expectOne(`${api}/auth/refresh-token`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({ success: true, data: session('access-2', 'refresh-2') });

    for (const url of [`${api}/course`, `${api}/booking`]) {
      const retry = backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
      retry.flush({ ok: true });
    }
    expect(results).toHaveLength(2);
    expect(localStorage.getItem('ll.refreshToken')).toBe('refresh-2');
  });

  it('holds requests while the token is being renewed, then sends the new one', () => {
    auth.startSession(session('old', 'refresh-1'));
    auth.refreshAccessToken().subscribe();

    http.get(`${api}/course`).subscribe();
    backend.expectNone(`${api}/course`);

    backend
      .expectOne(`${api}/auth/refresh-token`)
      .flush({ success: true, data: session('new', 'refresh-2') });
    expect(backend.expectOne(`${api}/course`).request.headers.get('Authorization')).toBe(
      'Bearer new',
    );
  });

  it('ends the session when the refresh fails', () => {
    auth.startSession(session('expired', 'stolen'));
    let error: ApiErrorResponse | undefined;

    http.get(`${api}/course`).subscribe({ error: (e: ApiErrorResponse) => (error = e) });
    backend.expectOne(`${api}/course`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne(`${api}/auth/refresh-token`)
      .flush(
        { success: false, status: 400, message: 'Invalid or expired refresh token' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(auth.isAuthenticated()).toBe(false);
    expect(error?.status).toBe(401);
  });

  it('does not try to refresh when login itself returns 401', () => {
    auth.startSession(session('a', 'r'));
    http.post(`${api}/auth/login`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${api}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectNone(`${api}/auth/refresh-token`);
  });

  it('passes the backend error body through and maps network failures', () => {
    const errors: ApiErrorResponse[] = [];
    const body: ApiErrorResponse = {
      success: false,
      status: 400,
      error: 'Bad Request',
      errorCode: 'BAD_REQUEST',
      message: 'Invalid email or password',
      path: '/api/v1/auth/login',
      timestamp: '',
    };

    http
      .post(`${api}/auth/login`, {})
      .subscribe({ error: (e: ApiErrorResponse) => errors.push(e) });
    backend.expectOne(`${api}/auth/login`).flush(body, { status: 400, statusText: 'Bad Request' });

    http.get(`${api}/course`).subscribe({ error: (e: ApiErrorResponse) => errors.push(e) });
    backend.expectOne(`${api}/course`).error(new ProgressEvent('error'), { status: 0 });

    expect(errors[0]).toEqual(body);
    expect(errors[1]?.errorCode).toBe('NETWORK_ERROR');
  });
});
