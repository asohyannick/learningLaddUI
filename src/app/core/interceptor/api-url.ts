import { environment } from '../../../environments/environment';

/** True for calls to our own REST API. Tokens must never be sent to third-party URLs. */
export function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiUrl);
}

/** Auth endpoints that are public: a 401 here must not trigger a token refresh. */
const PUBLIC_AUTH_ENDPOINT =
  /\/auth\/(login|register|refresh-token|logout|verify-otp|resend-otp|forgot-password|reset-password|magic-link|google)\b/;

export function isPublicAuthRequest(url: string): boolean {
  return PUBLIC_AUTH_ENDPOINT.test(url);
}
