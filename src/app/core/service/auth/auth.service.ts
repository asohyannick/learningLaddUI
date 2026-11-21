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
/** Email waiting for OTP verification. Session storage: gone when the tab closes. */
const PENDING_EMAIL_KEY = 'll.pendingEmail';
/** Web Locks name: only one tab at a time may spend the (rotating) refresh token. */
const REFRESH_LOCK = 'll.token-refresh';

/** Renew the access token this long before it expires (at most a fifth of its lifetime). */
const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;
/** Wait before retrying a renewal that failed for a temporary reason (offline, 5xx, 429). */
const RETRY_DELAY_MS = 30_000;

/**
 * True when the server refused the refresh token itself (expired, revoked, reused), so the
 * session is over. Network errors, 5xx and 429 are temporary and are retried instead.
 */
export function isSessionRejected(error: unknown): boolean {
  return (
    isApiErrorResponse(error) && error.status >= 400 && error.status < 500 && error.status !== 429
  );
}

/**
 * Holds the session and keeps it alive.
 * - The access token (5 minutes) lives in memory only. It is renewed in the background shortly
 *   before it expires, after a reload, and when a sleeping tab becomes visible again, so the user
 *   never has to log in again while their refresh token (7 days) is valid.
 * - The refresh token and the user profile are kept in localStorage so a reload keeps you signed in.
 *   Tabs share them: signing out in one tab signs out all of them.
 *
 * Sign-up flow: `register()` → `verifyOtp()` (code from the email) → `login()`.
 */
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
  /** Epoch ms when the in-memory access token expires (0 = no token). */
  private accessTokenExpiresAt = 0;
  private refreshMarginMs = REFRESH_MARGIN_MS;

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  /** True while a session exists, even if the in-memory access token still needs renewing. */
  readonly isAuthenticated = computed(() => this._refreshToken() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);
  /** Where the signed-in user lands: their role's dashboard. */
  readonly dashboardPath = computed(() => dashboardPathFor(this.role()));
  /** Email of an account that still has to enter its OTP code (set after registering). */
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

  // ─── Sign-up and sign-in ────────────────────────────────────────────────

  /** Creates an unverified STUDENT account and emails a 6-digit code. Returns the API message. */
  register(body: IRegister): Observable<string> {
    return this.post(`${this.baseUrl}/register`, body);
  }

  /** Confirms the emailed code and activates the account. No tokens: the user logs in next. */
  verifyOtp(body: IVerifyOtpCode): Observable<string> {
    return this.post(`${this.baseUrl}/verify-otp`, body);
  }

  /** Sends a new code once the previous one has expired. */
  resendOtp(body: IResendOtpCode): Observable<string> {
    return this.post(`${this.baseUrl}/resend-otp`, body);
  }

  /** Logs in and starts the session. Navigation is left to the caller. */
  login(body: ILoginRequest): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/login`, body)
      .pipe(map((res) => this.startSession(res.data)));
  }

  /**
   * Exchanges a Firebase ID token (from the Google pop-up) for our own session.
   * First-time Google users get a verified STUDENT account.
   */
  loginWithGoogle(idToken: string): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/google`, {
        idToken,
      } satisfies IFirebaseIdToken)
      .pipe(map((res) => this.startSession(res.data)));
  }

  // ─── Magic link (passwordless sign-in) ──────────────────────────────────

  /** Emails a single-use sign-in link (verified, unblocked accounts). Returns the API message. */
  sendMagicLink(body: ISendMagicLinkToken): Observable<string> {
    return this.post(`${this.baseUrl}/magic-link/send`, body);
  }

  /** New link after one was requested (60 s cooldown); the previous link stops working. */
  resendMagicLink(body: IResendMagicLinkToken): Observable<string> {
    return this.post(`${this.baseUrl}/magic-link/resend`, body);
  }

  /**
   * Exchanges the token from the emailed link for a session. The API reads it from the
   * `verifyMagicLinkTokenDto` query parameter (not from a body). Navigation is left to the caller.
   */
  verifyMagicLink(magicLinkToken: string): Observable<IUserResponse> {
    return this.http
      .post<ApiResponse<ILoginResponse>>(`${this.baseUrl}/magic-link/verify`, null, {
        params: { verifyMagicLinkTokenDto: magicLinkToken },
      })
      .pipe(map((res) => this.startSession(res.data)));
  }

  /** Call with the `data` of a login, magic-link verify or Google sign-in response. */
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

  // ─── Passwords ──────────────────────────────────────────────────────────

  /** Emails a single-use reset link (verified, unblocked accounts only). Returns the API message. */
  forgotPassword(body: IForgotPassword): Observable<string> {
    return this.post(`${this.baseUrl}/forgot-password`, body);
  }

  /**
   * Sets a new password with the token from the reset link. The server signs out every session,
   * so a session in this browser is cleared too.
   */
  resetPassword(token: string, body: IResetPassword): Observable<string> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/reset-password`, body, { params: { token } })
      .pipe(
        map((res) => res.message),
        tap(() => this.endSession()),
      );
  }

  // ─── Keeping the session alive ──────────────────────────────────────────

  /** Called once at start-up: a reload loses the access token, so get a new one right away. */
  restoreSession(): void {
    this.renewIfDue();
  }

  /**
   * The access token to send with an API request. Waits for a renewal that is in progress, or
   * starts one when the token is missing (after a reload), so requests do not fail with 401.
   */
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

  /**
   * Exchanges the refresh token for a new token pair (the old one stops working: rotation).
   * Concurrent callers share one request, so parallel 401s trigger a single refresh.
   */
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

  /** Session is over (refresh token rejected): clear it and ask the user to log in again. */
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

  // ─── Signing out ────────────────────────────────────────────────────────

  /**
   * Revokes the refresh token on the server, then clears the local session either way
   * (a failed revoke must never keep the user signed in here). Navigation is left to the caller.
   */
  logout(): Observable<void> {
    // A renewal in progress rotates the refresh token: wait for it so we revoke the current one.
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

  /**
   * Soft-deletes the signed-in user's own account (password required) and ends the session.
   * Super admin accounts cannot be deleted. Returns the API message.
   */
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

  /** Clears tokens and profile in memory and storage. */
  endSession(): void {
    this.clearRefreshTimer();
    this.accessTokenExpiresAt = 0;
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    removeStorage(REFRESH_TOKEN_KEY);
    removeStorage(USER_KEY);
  }

  // ─── Internals ──────────────────────────────────────────────────────────

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

  /** The newest refresh token: another tab may have rotated it since we last looked. */
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
    // Reusing an already-rotated refresh token makes the server revoke the whole session, so two
    // tabs must never refresh at the same time. The lock queues them; each reads the newest token.
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

  /** Another tab signed in, renewed the tokens or signed out. */
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
        // A different account signed in elsewhere: our access token belongs to the old one.
        this._accessToken.set(null);
        this.accessTokenExpiresAt = 0;
      }
      this._user.set(user);
    }
  }
}

// Storage can throw (private mode, blocked site data), so every access is guarded.
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
  } catch {
    /* session then only lasts until reload */
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to clear */
  }
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
  } catch {
    /* the value then only lives in memory */
  }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* nothing to clear */
  }
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
