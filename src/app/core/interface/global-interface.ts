import { UserRole } from '../enum/global-enum-configuration';

export interface IRegister {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export type ISODateString = string;

export type UUID = string;

export interface IBlockAccountRequest {
  reason: string;
}

export interface IDeleteAccountRequest {
  password: string;
  reason?: string | null;
}

export interface IUnBlockAccountRequest {
  reason: string;
}

export interface IFirebaseIdToken {
  idToken: string;
}

export interface IForgotPassword {
  email: string;
}

export interface IResetPassword {
  newPassword: string;
  confirmPassword: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

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

export interface IGenerateNewAccessToken {
  refreshToken: string;
}

export interface IGenerateNewAccessTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  accessTokenExpiresAt: ISODateString;

  refreshToken: string;
  refreshTokenExpiresIn: number;
  refreshTokenExpiresAt: ISODateString;

  tokenType: string;
}

export interface ILogoutRequest {
  refreshToken: string;
}

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

export interface IPageQuery {
  page?: number;
  size?: number;
  sortBy?: PageSortField;
  sortDirection?: 'ASC' | 'DESC';
}

export type PageSortField = 'firstName' | 'lastName' | 'email' | 'role' | 'createdAt' | 'updatedAt';

export interface ISendMagicLinkToken {
  email: string;
}

export interface IResendMagicLinkToken {
  email: string;
}

export interface IVerifyMagicLinkToken {
  magicLinkToken: string;
}

export interface IResendOtpCode {
  email: string;
}

export interface IVerifyOtpCode {
  otpCode: string;
}

export interface ITokenQuery {
  token: string;
}

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
