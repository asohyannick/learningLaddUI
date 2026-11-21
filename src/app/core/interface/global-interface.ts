import { UserRole } from '../enum/global-enum-configuration';

// ==========================================
// REGISTRATION DTOs
// ==========================================

/**
 * Create a STUDENT account. A 6-digit code is then emailed (see IVerifyOtpCode).
 */
export interface IRegister {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * ISO 8601 UTC timestamp returned by the Spring Boot backend.
 * Example: 2026-09-16T13:05:35Z
 */
export type ISODateString = string;

/**
 * Java UUID serialized as a string.
 */
export type UUID = string;

// ==========================================
// ACCOUNT MANAGEMENT DTOs
// ==========================================

/**
 * Request to block a user account.
 * reason: required, 5-500 characters.
 */
export interface IBlockAccountRequest {
  reason: string;
}

/**
 * Request to delete an account.
 * password: required, non-blank.
 * reason: optional, maximum 500 characters.
 */
export interface IDeleteAccountRequest {
  password: string;
  reason?: string | null;
}

/**
 * Request to unblock a user account.
 * reason: required, 5-500 characters.
 */
export interface IUnBlockAccountRequest {
  reason: string;
}

// ==========================================
// FIREBASE AUTHENTICATION DTOs
// ==========================================

/**
 * Firebase ID token obtained after sign-in.
 * idToken: required, maximum 4096 characters.
 */
export interface IFirebaseIdToken {
  idToken: string;
}

// ==========================================
// PASSWORD MANAGEMENT DTOs
// ==========================================

/**
 * Request a password reset email.
 * email: required, valid email, maximum 256 characters
 * according to @Size in the Java DTO.
 */
export interface IForgotPassword {
  email: string;
}

/**
 * Reset the account password.
 * newPassword: required, 8-72 characters.
 * Must contain uppercase, lowercase, digit,
 * and special character.
 *
 * confirmPassword: required, maximum 72 characters.
 * Must match newPassword.
 */
export interface IResetPassword {
  newPassword: string;
  confirmPassword: string;
}

// ==========================================
// LOGIN DTOs
// ==========================================

/**
 * User login request.
 */
export interface ILoginRequest {
  email: string;
  password: string;
}

/**
 * User login response.
 *
 * Backend uses @JsonInclude(NON_NULL),
 * so nullable fields may be omitted.
 */
export interface ILoginResponse {
  id: UUID;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: UserRole;

  isAccountVerified: boolean;
  isAccountDeleted: boolean;
  isAccountBlocked: boolean;

  accessToken: string;
  accessTokenExpiresIn: number;
  accessTokenExpiresAt: ISODateString;

  refreshToken: string;
  refreshTokenExpiresIn?: number;
  refreshTokenExpiresAt?: ISODateString;

  tokenType: string;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ==========================================
// TOKEN MANAGEMENT DTOs
// ==========================================

/**
 * Request a new access token using a refresh token.
 * refreshToken: required, maximum 4096 characters.
 */
export interface IGenerateNewAccessToken {
  refreshToken: string;
}

/**
 * Response containing a refreshed token pair.
 */
export interface IGenerateNewAccessTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  accessTokenExpiresAt: ISODateString;

  refreshToken: string;
  refreshTokenExpiresIn: number;
  refreshTokenExpiresAt: ISODateString;

  tokenType: string;
}

/**
 * Log out using an existing refresh token.
 */
export interface ILogoutRequest {
  refreshToken: string;
}

// ==========================================
// PAGINATION DTOs
// ==========================================

/**
 * Generic paginated response returned by Spring Data.
 */
export interface IPagedResponse<T> {
  content: T[];

  pageNumber: number;
  pageSize: number;
  numberOfElements: number;

  totalElements: number;
  totalPages: number;

  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Pagination and sorting query parameters.
 *
 * All properties are optional because the Java
 * PageQuery.of() method supplies defaults.
 *
 * The Java PageQuery record itself has four
 * non-null-normalized constructor fields.
 */
export interface IPageQuery {
  page?: number;
  size?: number;
  sortBy?: PageSortField;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * Allowed sort fields from the Java backend.
 */
export type PageSortField = 'firstName' | 'lastName' | 'email' | 'role' | 'createdAt' | 'updatedAt';

// ==========================================
// MAGIC LINK DTOs
// ==========================================

/**
 * Request a new magic link.
 */
export interface ISendMagicLinkToken {
  email: string;
}

/**
 * Request another magic link.
 */
export interface IResendMagicLinkToken {
  email: string;
}

/**
 * Verify a magic link token.
 * Maximum 255 characters.
 */
export interface IVerifyMagicLinkToken {
  magicLinkToken: string;
}

// ==========================================
// OTP DTOs
// ==========================================

/**
 * Request a new OTP code.
 */
export interface IResendOtpCode {
  email: string;
}

/**
 * Verify a six-digit OTP code.
 *
 * Use string rather than number to preserve
 * leading zeros.
 */
export interface IVerifyOtpCode {
  otpCode: string;
}

// ==========================================
// RESET TOKEN DTOs
// ==========================================

/**
 * Reset token obtained from an email link.
 */
export interface ITokenQuery {
  token: string;
}

// ==========================================
// USER RESPONSE DTOs
// ==========================================

/**
 * User account details returned by the backend.
 *
 * Nullable fields may be omitted because the
 * Java DTO uses @JsonInclude(NON_NULL).
 */
export interface IUserResponse {
  id: UUID;

  firstName?: string | null;
  lastName?: string | null;

  email: string;
  role: UserRole;

  isAccountVerified: boolean;
  isAccountDeleted: boolean;
  isAccountBlocked: boolean;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}
