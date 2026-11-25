import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../enum/global-enum-configuration';
import {
  ApiResponse,
  IDeleteAccountRequest,
  IFirebaseIdToken,
  IForgotPassword,
  IGenerateNewAccessToken,
  IGenerateNewAccessTokenResponse,
  ILoginRequest,
  ILoginResponse,
  ILogoutRequest,
  IRegister,
  IResendMagicLinkToken,
  IResendOtpCode,
  ISendMagicLinkToken,
  IResetPassword,
  IUserResponse,
  IVerifyOtpCode,
  isApiErrorResponse,
} from '../../interface';
import { TokenPair, dashboardPathFor, safeReturnUrl, toSession } from './auth-session';

const REFRESH_TOKEN_KEY = 'll.refreshToken';
const USER_KEY = 'll.user';
const PENDING_EMAIL_KEY = 'll.pendingEmail';
const REFRESH_LOCK = 'll.token-refresh';

const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;
const RETRY_DELAY_MS = 30_000;

export function isSessionRejected(error: unknown): boolean {
  return (
    isApiErrorResponse(error) && error.status >= 400 && error.status < 500 && error.status !== 429
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(readStorage(REFRESH_TOKEN_KEY));
  private readonly _user = signal<IUserResponse | null>(parseUser(readStorage(USER_KEY)));
  private readonly _pendingEmail = signal<string | null>(readSession(PENDING_EMAIL_KEY));

  private refreshInFlight$: Observable<string> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private accessTokenExpiresAt = 0;
  private refreshMarginMs = REFRESH_MARGIN_MS;

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._refreshToken() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);
  readonly dashboardPath = computed(() => dashboardPathFor(this.role()));
  readonly pendingEmail = this._pendingEmail.asReadonly();

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    const onStorage = (event: StorageEvent) => this.syncFromOtherTab(event);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        this.renewIfDue();
      }
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      this.clearRefreshTimer();
    });
  }

  register(body: IRegister): Observable<string> {
    return this.post(`${this.baseUrl}/register`, body);
  }

  verifyOtp(body: IVerifyOtpCode): Observable<string> {
    return this.post(`${this.baseUrl}/verify-otp`, body);
  }

  resendOtp(body: IResendOtpCode): Observable<string> {
    return this.post(`${this.baseUrl}/resend-otp`, body);
  }

  login(body: ILoginRequest): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/login`, body)
      .pipe(map((res) => this.startSession(res.data)));
  }

  loginWithGoogle(idToken: string): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/google`, {
        idToken,
      } satisfies IFirebaseIdToken)
      .pipe(map((res) => this.startSession(res.data)));
  }

  sendMagicLink(body: ISendMagicLinkToken): Observable<string> {
    return this.post(`${this.baseUrl}/magic-link/send`, body);
  }

  resendMagicLink(body: IResendMagicLinkToken): Observable<string> {
    return this.post(`${this.baseUrl}/magic-link/resend`, body);
  }

  verifyMagicLink(magicLinkToken: string): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/magic-link/verify`, null, {
        params: { verifyMagicLinkTokenDto: magicLinkToken },
      })
      .pipe(map((res) => this.startSession(res.data)));
  }

  startSession(data: ILoginResponse): IUserResponse {
    const { tokens, user } = toSession(data);
    this.storeTokens(tokens);
    this._user.set(user);
    writeStorage(USER_KEY, JSON.stringify(user));
    this.setPendingEmail(null);
    return user;
  }

  setPendingEmail(email: string | null): void {
    this._pendingEmail.set(email);
    if (email) {
      writeSession(PENDING_EMAIL_KEY, email);
    } else {
      removeSession(PENDING_EMAIL_KEY);
    }
  }

  hasAnyRole(allowed: readonly UserRole[]): boolean {
    const role = this.role();
    return role !== null && allowed.includes(role);
  }

  forgotPassword(body: IForgotPassword): Observable<string> {
    return this.post(`${this.baseUrl}/forgot-password`, body);
  }

  resetPassword(token: string, body: IResetPassword): Observable<string> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/reset-password`, body, { params: { token } })
      .pipe(
        map((res) => res.message),
        tap(() => this.endSession()),
      );
  }

  restoreSession(): void {
    this.renewIfDue();
  }

  ensureAccessToken(): Observable<string | null> {
    const pending =
      this.refreshInFlight$ ??
      (this.isAuthenticated() && !this._accessToken() ? this.refreshAccessToken() : null);
    if (!pending) {
      return of(this._accessToken());
    }
    return pending.pipe(
      catchError((error: unknown) => {
        this.handleRefreshFailure(error);
        return of(null);
      }),
      map(() => this._accessToken()),
    );
  }

  refreshAccessToken(): Observable<string> {
    if (!this.latestRefreshToken()) {
      return throwError(() => new Error('No refresh token available'));
    }
    this.refreshInFlight$ ??= this.requestNewTokens().pipe(
      tap((tokens) => this.storeTokens(tokens)),
      map((tokens) => tokens.accessToken),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  expireSession(): void {
    if (!this.isAuthenticated()) {
      return;
    }
    const returnUrl = safeReturnUrl(this.router.url);
    this.endSession();
    void this.router.navigate(['/login'], {
      queryParams: { expired: 'true', ...(returnUrl && returnUrl !== '/' ? { returnUrl } : {}) },
    });
  }

  logout(): Observable<void> {
    const settled$ = this.refreshInFlight$
      ? this.refreshInFlight$.pipe(catchError(() => of(null)))
      : of(null);
    return settled$.pipe(
      switchMap(() => {
        const refreshToken = this.latestRefreshToken();
        if (!refreshToken) {
          return of(undefined);
        }
        return this.http
          .post<ApiResponse<unknown>>(`${this.baseUrl}/logout`, {
            refreshToken,
          } satisfies ILogoutRequest)
          .pipe(
            map(() => undefined),
            catchError(() => of(undefined)),
          );
      }),
      finalize(() => this.endSession()),
    );
  }

  deleteAccount(body: IDeleteAccountRequest): Observable<string> {
    const userId = this._user()?.id;
    if (!userId) {
      return throwError(() => new Error('Not signed in'));
    }
    return this.http
      .delete<ApiResponse<unknown>>(`${this.baseUrl}/account`, { params: { userId }, body })
      .pipe(
        map((res) => res.message),
        tap(() => this.endSession()),
      );
  }

  endSession(): void {
    this.clearRefreshTimer();
    this.accessTokenExpiresAt = 0;
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    removeStorage(REFRESH_TOKEN_KEY);
    removeStorage(USER_KEY);
  }

  private post(url: string, body: object): Observable<string> {
    return this.http.post<ApiResponse<unknown>>(url, body).pipe(map((res) => res.message));
  }

  private storeTokens(tokens: TokenPair): void {
    this._accessToken.set(tokens.accessToken);
    this._refreshToken.set(tokens.refreshToken);
    writeStorage(REFRESH_TOKEN_KEY, tokens.refreshToken);

    const lifetimeMs = (tokens.accessTokenExpiresIn > 0 ? tokens.accessTokenExpiresIn : 300) * 1000;
    this.refreshMarginMs = Math.min(REFRESH_MARGIN_MS, lifetimeMs / 5);
    this.accessTokenExpiresAt = Date.now() + lifetimeMs;
    this.scheduleRefresh(lifetimeMs - this.refreshMarginMs);
  }

  private latestRefreshToken(): string | null {
    return readStorage(REFRESH_TOKEN_KEY) ?? this._refreshToken();
  }

  private requestNewTokens(): Observable<IGenerateNewAccessTokenResponse> {
    const request$ = defer(() => {
      const refreshToken = this.latestRefreshToken();
      if (!refreshToken) {
        return throwError(() => new Error('No refresh token available'));
      }
      return this.http
        .post<ApiResponse<IGenerateNewAccessTokenResponse>>(`${this.baseUrl}/refresh-token`, {
          refreshToken,
        } satisfies IGenerateNewAccessToken)
        .pipe(map((res) => res.data));
    });
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks ? from(locks.request(REFRESH_LOCK, () => firstValueFrom(request$))) : request$;
  }

  private renewIfDue(): void {
    const due = Date.now() >= this.accessTokenExpiresAt - this.refreshMarginMs;
    if (this.isAuthenticated() && due) {
      this.renewInBackground();
    }
  }

  private renewInBackground(): void {
    this.refreshAccessToken().subscribe({
      error: (error: unknown) => this.handleRefreshFailure(error),
    });
  }

  private handleRefreshFailure(error: unknown): void {
    if (isSessionRejected(error)) {
      this.expireSession();
    } else if (this.isAuthenticated()) {
      this.scheduleRefresh(RETRY_DELAY_MS);
    }
  }

  private scheduleRefresh(delayMs: number): void {
    this.clearRefreshTimer();
    if (typeof window === 'undefined') {
      return;
    }
    this.refreshTimer = setTimeout(
      () => {
        this.refreshTimer = null;
        if (this.isAuthenticated()) {
          this.renewInBackground();
        }
      },
      Math.max(delayMs, MIN_REFRESH_DELAY_MS),
    );
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private syncFromOtherTab(event: StorageEvent): void {
    if (event.key === REFRESH_TOKEN_KEY || event.key === null) {
      const token = readStorage(REFRESH_TOKEN_KEY);
      if (token) {
        this._refreshToken.set(token);
      } else if (this.isAuthenticated()) {
        this.endSession();
        void this.router.navigate(['/login'], { queryParams: { signedOut: 'true' } });
      }
    }
    if (event.key === USER_KEY || event.key === null) {
      const user = parseUser(readStorage(USER_KEY));
      if (user && user.id !== this._user()?.id) {
        this._accessToken.set(null);
        this.accessTokenExpiresAt = 0;
      }
      this._user.set(user);
    }
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function parseUser(raw: string | null): IUserResponse | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as IUserResponse;
    return typeof user?.id === 'string' ? user : null;
  } catch {
    return null;
  }
}
