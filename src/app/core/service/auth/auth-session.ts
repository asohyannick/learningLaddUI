import { ADMIN_ROLES, UserRole } from '../../enum/global-enum-configuration';
import { LoginResponse, User } from '../../interface';

// Helpers that turn the raw login response into a typed session and pick the user's landing page.
//
// TODO: Swagger leaves the login `data` untyped. These helpers accept the shapes we expect
// (tokens at the top level or under `tokens`, user under `user`, roles as strings or objects,
// with or without the `ROLE_` prefix) and fall back to the JWT claims for the roles.
// Once a real response is confirmed, tighten `LoginResponse` and simplify this file.

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/** `'ROLE_STUDENT'`, `'student'` or `{ name: 'STUDENT' }` → `UserRole.STUDENT`. Unknown → null. */
export function toRole(value: unknown): UserRole | null {
  const raw = isObject(value) ? (value['name'] ?? value['role'] ?? value['authority']) : value;
  if (typeof raw !== 'string') {
    return null;
  }
  const name = raw
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, '');
  return KNOWN_ROLES.has(name) ? (name as UserRole) : null;
}

/** Accepts one role, a list, or a space/comma separated string (JWT `scope`). */
export function toRoles(value: unknown): UserRole[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,]+/)
      : value == null
        ? []
        : [value];
  return [...new Set(list.map(toRole).filter((role): role is UserRole => role !== null))];
}

/** Reads the claims of a JWT without verifying it (the server verifies; this is display only). */
export function decodeJwtPayload(token: string): JsonObject | null {
  const part = token.split('.')[1];
  if (!part) {
    return null;
  }
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      Array.from(atob(base64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
    );
    const payload: unknown = JSON.parse(json);
    return isObject(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Turns `data` of `POST /auth/login` into a typed session. Throws if the tokens are missing. */
export function normalizeLoginResponse(data: unknown): LoginResponse {
  if (!isObject(data)) {
    throw new Error('Unexpected login response');
  }
  const tokens = isObject(data['tokens']) ? data['tokens'] : data;
  const accessToken = tokens['accessToken'];
  const refreshToken = tokens['refreshToken'];
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('Login response is missing tokens');
  }

  const source = isObject(data['user']) ? data['user'] : data;
  const claims = decodeJwtPayload(accessToken) ?? {};

  let roles = toRoles(source['roles'] ?? source['role']);
  if (roles.length === 0) {
    roles = toRoles(claims['roles'] ?? claims['role'] ?? claims['authorities'] ?? claims['scope']);
  }

  const user: User = {
    id: asString(source['id'] ?? source['userId'] ?? claims['userId'] ?? claims['sub']),
    firstName: asString(source['firstName']),
    lastName: asString(source['lastName']),
    email: asString(source['email'] ?? claims['email'] ?? claims['sub']),
    role: roles[0],
    roles,
  };

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: asNumber(tokens['accessTokenExpiresIn']),
    accessTokenExpiresAt: asString(tokens['accessTokenExpiresAt']),
    refreshTokenExpiresIn: asNumber(tokens['refreshTokenExpiresIn']),
    refreshTokenExpiresAt: asString(tokens['refreshTokenExpiresAt']),
    tokenType: 'Bearer',
    user,
  };
}

/** The dashboard a user lands on. With several roles, the most privileged one wins. */
export function dashboardPathFor(roles: readonly UserRole[]): string {
  if (roles.some((role) => ADMIN_ROLES.includes(role))) {
    return '/dashboard/admin';
  }
  if (roles.includes(UserRole.TUTOR) || roles.includes(UserRole.LECTURER)) {
    return '/dashboard/tutor';
  }
  if (roles.includes(UserRole.LIBRARIAN)) {
    return '/dashboard/librarian';
  }
  if (roles.includes(UserRole.STUDENT)) {
    return '/dashboard/student';
  }
  return '/';
}

const AUTH_PAGES = /^\/(login|register|verify-otp|forgot-password|reset-password|magic-link)\b/;

/**
 * Only same-app paths are accepted as `returnUrl`, so a crafted link cannot send the user to
 * another site or back into the auth pages.
 */
export function safeReturnUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return null;
  }
  if (url.includes('\\') || /[\u0000-\u001f]/.test(url) || AUTH_PAGES.test(url)) {
    return null;
  }
  return url;
}
