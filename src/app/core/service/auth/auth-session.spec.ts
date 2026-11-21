import { UserRole } from '../../enum/global-enum-configuration';
import { ILoginResponse } from '../../interface';
import { fakeLoginResponse } from '../../testing/fake-login-response';
import { dashboardPathFor, safeReturnUrl, toSession } from './auth-session';

describe('auth-session', () => {
  it('splits a login response into tokens and a profile without tokens', () => {
    const { tokens, user } = toSession(fakeLoginResponse({ role: UserRole.LIBRARIAN }));
    expect(tokens).toEqual({
      accessToken: 'access-1',
      accessTokenExpiresIn: 300,
      refreshToken: 'refresh-1',
    });
    expect(user).toMatchObject({ firstName: 'Amara', role: UserRole.LIBRARIAN });
    expect(JSON.stringify(user)).not.toContain('refresh-1');
    expect(JSON.stringify(user)).not.toContain('access-1');
  });

  it('refuses a response without tokens', () => {
    expect(() => toSession({ id: '1' } as ILoginResponse)).toThrow();
    expect(() => toSession(null)).toThrow();
  });

  it('picks the dashboard for each role', () => {
    expect(dashboardPathFor(UserRole.SUPER_ADMIN)).toBe('/dashboard/admin');
    expect(dashboardPathFor(UserRole.IT_ADMIN)).toBe('/dashboard/admin');
    expect(dashboardPathFor(UserRole.LECTURER)).toBe('/dashboard/tutor');
    expect(dashboardPathFor(UserRole.PROFESSOR)).toBe('/dashboard/tutor');
    expect(dashboardPathFor(UserRole.LIBRARIAN)).toBe('/dashboard/librarian');
    expect(dashboardPathFor(UserRole.STUDENT)).toBe('/dashboard/student');
    expect(dashboardPathFor(UserRole.PARENT)).toBe('/');
    expect(dashboardPathFor(null)).toBe('/');
  });

  it('only accepts same-app return URLs', () => {
    expect(safeReturnUrl('/library?tab=2')).toBe('/library?tab=2');
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/login',
      '/logout',
      '/reset-password?token=x',
      undefined,
    ]) {
      expect(safeReturnUrl(bad)).toBeNull();
    }
  });
});
