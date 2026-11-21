import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { UserRole } from '../enum/global-enum-configuration';
import { AuthService } from '../service/auth/auth.service';
import { authGuard, guestGuard, roleGuard } from './auth.guard';

function run(guard: CanActivateFn, url = '/courses'): MaybeAsync<GuardResult> {
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

function signIn(role: UserRole): void {
  TestBed.inject(AuthService).startSession({
    accessToken: 'a',
    refreshToken: 'r',
    accessTokenExpiresIn: 300,
    accessTokenExpiresAt: '',
    refreshTokenExpiresIn: 604800,
    refreshTokenExpiresAt: '',
    tokenType: 'Bearer',
    user: { id: '1', firstName: 'A', lastName: 'B', email: 'a@b.c', role },
  });
}

describe('auth guards', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    router = TestBed.inject(Router);
  });

  it('authGuard sends signed-out users to /login with a returnUrl', () => {
    const result = run(authGuard) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fcourses');
  });

  it('authGuard lets signed-in users through', () => {
    signIn(UserRole.STUDENT);
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard sends signed-in users to their dashboard', () => {
    expect(run(guestGuard)).toBe(true);
    signIn(UserRole.STUDENT);
    expect(router.serializeUrl(run(guestGuard) as UrlTree)).toBe('/dashboard/student');
    signIn(UserRole.LECTURER);
    expect(router.serializeUrl(run(guestGuard) as UrlTree)).toBe('/dashboard/tutor');
  });

  it('roleGuard checks the role', () => {
    const adminOnly = roleGuard([UserRole.ADMIN]);
    expect(router.serializeUrl(run(adminOnly) as UrlTree)).toContain('/login');
    signIn(UserRole.STUDENT);
    expect(router.serializeUrl(run(adminOnly) as UrlTree)).toBe('/dashboard/student');
    signIn(UserRole.ADMIN);
    expect(run(adminOnly)).toBe(true);
  });
});
