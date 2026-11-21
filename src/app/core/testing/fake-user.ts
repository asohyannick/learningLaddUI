import { UserRole } from '../enum/global-enum-configuration';
import { IUserResponse } from '../interface';

/** Test data shaped like a user from `GET /auth/users`. */
export function fakeUser(overrides: Partial<IUserResponse> = {}): IUserResponse {
  return {
    id: 'u-1',
    firstName: 'Bola',
    lastName: 'Ade',
    email: 'bola@example.com',
    role: UserRole.STUDENT,
    isAccountVerified: true,
    isAccountDeleted: false,
    isAccountBlocked: false,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}
