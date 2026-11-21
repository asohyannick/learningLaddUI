import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, map, of, shareReplay, tap, throwError, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../enum/global-enum-configuration';
import {
  ApiResponse,
  AuthTokens,
  IGenerateNewAccessToken,
  ILogin,
  ILogout,
  IRegister,
  IResendOtp,
  IVerifyOtp,
  LoginResponse,
  User,
} from '../../interface';
import { dashboardPathFor, normalizeLoginResponse } from './auth-session';

const REFRESH_TOKEN_KEY = 'll.refreshToken';
const USER_KEY = 'll.user';
/** Email waiting for OTP verification. Session storage: gone when the tab closes. */
const PENDING_EMAIL_KEY = 'll.pendingEmail';

/**
 * Holds the session and keeps tokens fresh.
 * - The access token lives in memory only (lost on reload, then renewed on the first 401).
 * - The refresh token and the user profile are kept in localStorage so a reload keeps you signed in.
 *
 * Sign-up flow: `register()` → `verifyOtp()` (code from the email) → `login()`.
 * The interceptor only needs `refreshAccessToken()` and `endSession()`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly _accessToken = signal<string | null>(null);
  private readonly _refreshToken = signal<string | null>(readStorage(REFRESH_TOKEN_KEY));
  private readonly _user = signal<User | null>(readUser());
  private readonly _pendingEmail = signal<string | null>(readSession(PENDING_EMAIL_KEY));
  private refreshInFlight$: Observable<string> | null = null;

  readonly accessToken = this._accessToken.asReadonly();
  readonly user = this._user.asReadonly();
  /** True while a session exists, even if the in-memory access token still needs renewing. */
  readonly isAuthenticated = computed(() => this._refreshToken() !== null);
  readonly roles = computed<UserRole[]>(() => {
    const user = this._user();
    return user?.roles ?? (user?.role ? [user.role] : []);
  });
  /** Where the signed-in user lands: their role's dashboard. */
  readonly dashboardPath = computed(() => dashboardPathFor(this.roles()));
  /** Email of an account that still has to enter its OTP code (set after registering). */
  readonly pendingEmail = this._pendingEmail.asReadonly();

  // ─── Sign-up and sign-in ────────────────────────────────────────────────

  /** Creates an unverified STUDENT account and emails a 6-digit code. Returns the API message. */
  register(body: IRegister): Observable<string> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/register`, body)
      .pipe(map((res) => res.message));
  }

  /** Confirms the emailed code and activates the account. No tokens: the user logs in next. */
  verifyOtp(body: IVerifyOtp): Observable<string> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/verify-otp`, body)
      .pipe(map((res) => res.message));
  }

  /** Sends a new code once the previous one has expired. */
  resendOtp(body: IResendOtp): Observable<string> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/resend-otp`, body)
      .pipe(map((res) => res.message));
  }

  /** Logs in and starts the session. Navigation is left to the caller. */
  login(body: ILogin): Observable<LoginResponse> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/login`, body).pipe(
      map((res) => normalizeLoginResponse(res.data)),
      tap((session) => {
        this.startSession(session);
        this.setPendingEmail(null);
      }),
    );
  }

  setPendingEmail(email: string | null): void {
    this._pendingEmail.set(email);
    if (email) {
      writeSession(PENDING_EMAIL_KEY, email);
    } else {
      removeSession(PENDING_EMAIL_KEY);
    }
  }

  /** Call after a successful login, magic-link verify or Google sign-in. */
  startSession(session: LoginResponse): void {
    this.storeTokens(session);
    this._user.set(session.user);
    writeStorage(USER_KEY, JSON.stringify(session.user));
  }

  hasAnyRole(allowed: readonly UserRole[]): boolean {
    return this.roles().some((role) => allowed.includes(role));
  }

  /**
   * Exchanges the refresh token for a new token pair (the old one stops working: rotation).
   * Concurrent callers share one request, so parallel 401s trigger a single refresh.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this._refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }
    this.refreshInFlight$ ??= this.http
      .post<ApiResponse<AuthTokens>>(`${this.baseUrl}/refresh-token`, {
        refreshToken,
      } satisfies IGenerateNewAccessToken)
      .pipe(
        tap((res) => this.storeTokens(res.data)),
        map((res) => res.data.accessToken),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight$;
  }

  /** Revokes the refresh token on the server, then clears the local session either way. */
  logout(): Observable<void> {
    const refreshToken = this._refreshToken();
    const revoke$ = refreshToken
      ? this.http
          .post<ApiResponse<unknown>>(`${this.baseUrl}/logout`, { refreshToken } satisfies ILogout)
          .pipe(
            map(() => undefined),
            catchError(() => of(undefined)),
          )
      : of(undefined);
    return revoke$.pipe(finalize(() => this.endSession()));
  }

  /** Clears tokens and user locally and sends the user to the login page. */
  endSession(redirectToLogin = true): void {
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    removeStorage(REFRESH_TOKEN_KEY);
    removeStorage(USER_KEY);
    if (redirectToLogin) {
      void this.router.navigateByUrl('/login');
    }
  }

  private storeTokens(tokens: AuthTokens): void {
    this._accessToken.set(tokens.accessToken);
    this._refreshToken.set(tokens.refreshToken);
    writeStorage(REFRESH_TOKEN_KEY, tokens.refreshToken);
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

function readUser(): User | null {
  const raw = readStorage(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
