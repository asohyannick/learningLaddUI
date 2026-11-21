import { UserRole } from '../enum/global-enum-configuration';

// ─── Auth request bodies (match the Swagger DTOs) ──────────────────────────

export interface IRegister {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface IVerifyOtp {
  otpCode: string;
}

export interface IResendOtp {
  email: string;
}

export interface ILogin {
  email: string;
  password: string;
}

export interface IBlockAccount {
  reason: string;
}

export interface IUnblockAccount {
  reason: string;
}

export interface IDeleteAccount {
  password: string;
  reason?: string;
}

export interface IFirebaseId {
  idToken: string;
}

export interface IForgotPassword {
  email: string;
}

export interface IResetPassword {
  newPassword: string;
  confirmPassword: string;
}

export interface ISendMagicLink {
  email: string;
}

export interface IGenerateNewAccessToken {
  refreshToken: string;
}

export interface ILogout {
  refreshToken: string;
}

// ─── Auth responses ─────────────────────────────────────────────────────────

/** `data` of `POST /auth/refresh-token`. Login, magic link and Google sign-in return these too. */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
  tokenType: 'Bearer';
}

/**
 * The signed-in user's profile.
 * TODO: Swagger leaves this untyped. Check it against a real login response and tighten it.
 */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
  roles?: UserRole[];
}

/** `data` of login / magic-link verify / Google sign-in: the user profile plus tokens. */
export interface LoginResponse extends AuthTokens {
  user: User;
}
