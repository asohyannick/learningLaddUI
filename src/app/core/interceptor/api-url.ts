import { environment } from '../../../environments/environment';

export function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiUrl);
}

const PUBLIC_AUTH_ENDPOINT =
  /\/auth\/(login|register|refresh-token|logout|verify-otp|resend-otp|forgot-password|reset-password|magic-link|google)\b/;

export function isPublicAuthRequest(url: string): boolean {
  return PUBLIC_AUTH_ENDPOINT.test(url);
}
