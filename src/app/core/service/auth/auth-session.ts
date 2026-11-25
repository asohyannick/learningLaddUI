import { ADMIN_ROLES, UserRole } from '../../enum/global-enum-configuration';
import { ILoginResponse, IUserResponse } from '../../interface';

export type TokenPair = Pick<
  ILoginResponse,
  'accessToken' | 'accessTokenExpiresIn' | 'refreshToken'
>;

export function toSession(data: ILoginResponse | null | undefined): {
  tokens: TokenPair;
  user: IUserResponse;
} {
  if (!data || typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
    throw new Error('Login response is missing tokens');
  }
  const { accessToken, accessTokenExpiresIn, refreshToken } = data;
  const user: IUserResponse = {
    id: data.id,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    role: data.role,
    isAccountVerified: data.isAccountVerified,
    isAccountDeleted: data.isAccountDeleted,
    isAccountBlocked: data.isAccountBlocked,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
  return { tokens: { accessToken, accessTokenExpiresIn, refreshToken }, user };
}

export function dashboardPathFor(role: UserRole | null | undefined): string {
  if (!role) {
    return '/';
  }
  if (ADMIN_ROLES.includes(role)) {
    return '/dashboard/admin';
  }
  if (role === UserRole.PROFESSOR || role === UserRole.LECTURER) {
    return '/dashboard/tutor';
  }
  if (role === UserRole.LIBRARIAN) {
    return '/dashboard/librarian';
  }
  if (role === UserRole.STUDENT) {
    return '/dashboard/student';
  }
  return '/';
}

const AUTH_PAGES =
  /^\/(login|logout|register|verify-otp|forgot-password|reset-password|magic-link)\b/;

export function safeReturnUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return null;
  }
  if (url.includes('\\') || /[\u0000-\u001f]/.test(url) || AUTH_PAGES.test(url)) {
    return null;
  }
  return url;
}
