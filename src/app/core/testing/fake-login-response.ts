import { UserRole } from '../enum/global-enum-configuration';
import { ApiResponse, ILoginResponse } from '../interface';

export function fakeLoginResponse(overrides: Partial<ILoginResponse> = {}): ILoginResponse {
  return {
    id: 'fbdf6d54-e471-448d-87b1-262416f9e3a5',
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara@example.com',
    role: UserRole.STUDENT,
    isAccountVerified: true,
    isAccountDeleted: false,
    isAccountBlocked: false,
    accessToken: 'access-1',
    accessTokenExpiresIn: 300,
    accessTokenExpiresAt: '2026-11-21T12:33:47Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresIn: 604800,
    refreshTokenExpiresAt: '2026-11-28T12:28:47Z',
    tokenType: 'Bearer',
    createdAt: '2026-11-21T12:28:04Z',
    updatedAt: '2026-11-21T12:28:21Z',
    ...overrides,
  };
}

export function ok<T>(data: T, message = 'OK'): ApiResponse<T> {
  return { success: true, status: 200, message, data, path: '', timestamp: '' };
}
