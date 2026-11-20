export interface IRegister {
 firstName: string;
 lastName: string;
 email: string;
 password: string;
} 

export interface ILogin {
 email: string;
 password: string;
}

export interface IBlockAccount {
  reason: string
}

export interface IDeleteAccount {
  password: string;
  reason: string;
}

export interface IFirebaseId {
  idToken: string
}

export interface IForgotPassword {
  email: string
}

export interface IGenerateNewAccessToken {
  refreshToken: string;
}



