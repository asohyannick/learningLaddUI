import { UserRole } from '../../enum/global-enum-configuration';
import { dashboardPathFor, normalizeLoginResponse, safeReturnUrl, toRoles } from './auth-session';

function jwt(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

describe('auth-session helpers', () => {
  it('reads roles in their different shapes', () => {
    expect(toRoles('ROLE_STUDENT')).toEqual([UserRole.STUDENT]);
    expect(toRoles(['tutor', { name: 'ROLE_LIBRARIAN' }, 'UNKNOWN'])).toEqual([
      UserRole.TUTOR,
      UserRole.LIBRARIAN,
    ]);
    expect(toRoles('ROLE_ADMIN ROLE_STUDENT')).toEqual([UserRole.ADMIN, UserRole.STUDENT]);
    expect(toRoles(undefined)).toEqual([]);
  });

  it('normalizes a login response with a user object', () => {
    const session = normalizeLoginResponse({
      accessToken: 'a.b.c',
      refreshToken: 'r',
      user: { id: 7, firstName: 'Amara', lastName: 'O', email: 'a@x.io', role: 'ROLE_TUTOR' },
    });
    expect(session.accessToken).toBe('a.b.c');
    expect(session.user).toMatchObject({ id: '7', firstName: 'Amara', roles: [UserRole.TUTOR] });
  });

  it('falls back to the JWT claims when the user has no role', () => {
    const session = normalizeLoginResponse({
      tokens: { accessToken: jwt({ sub: 'a@x.io', roles: ['ROLE_LIBRARIAN'] }), refreshToken: 'r' },
    });
    expect(session.user.roles).toEqual([UserRole.LIBRARIAN]);
    expect(session.user.email).toBe('a@x.io');
  });

  it('rejects a response without tokens', () => {
    expect(() => normalizeLoginResponse({ user: {} })).toThrow();
    expect(() => normalizeLoginResponse(null)).toThrow();
  });

  it('sends each role to its dashboard, most privileged first', () => {
    expect(dashboardPathFor([UserRole.STUDENT])).toBe('/dashboard/student');
    expect(dashboardPathFor([UserRole.LECTURER])).toBe('/dashboard/tutor');
    expect(dashboardPathFor([UserRole.LIBRARIAN])).toBe('/dashboard/librarian');
    expect(dashboardPathFor([UserRole.STUDENT, UserRole.SUPER_ADMIN])).toBe('/dashboard/admin');
    expect(dashboardPathFor([])).toBe('/');
  });

  it('only accepts in-app return URLs', () => {
    expect(safeReturnUrl('/courses?page=2')).toBe('/courses?page=2');
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
