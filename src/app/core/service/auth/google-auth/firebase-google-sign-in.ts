import { Injectable } from '@angular/core';
import type { FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { environment } from '../../../../../environments/environment';
import { isApiErrorResponse } from '../../../interface';

type FirebaseAuthModule = typeof import('firebase/auth');

interface Ready {
  auth: Auth;
  fb: FirebaseAuthModule;
}

/** False while the environment file still holds the template placeholders. */
export function isFirebaseConfigured(config: FirebaseOptions = environment.firebase): boolean {
  return [config.apiKey, config.authDomain, config.projectId, config.appId].every(
    (value) => typeof value === 'string' && value.length > 0 && !value.startsWith('<'),
  );
}

/**
 * Opens the Google pop-up through Firebase and returns the Firebase ID token, which the backend
 * swaps for our own session (`POST /auth/google`).
 *
 * - The Firebase SDK is loaded on demand, so it is not part of the main bundle.
 * - Firebase keeps the Google session in memory only and signs out right after: our own access
 *   and refresh tokens are the only session in the browser.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseGoogleSignIn {
  readonly configured = isFirebaseConfigured();
  private ready: Ready | null = null;
  private loading: Promise<Ready> | null = null;

  /**
   * Loads the SDK ahead of the click. Browsers only allow pop-ups straight after a click, so the
   * pop-up must open without waiting for a download first.
   */
  prepare(): Promise<Ready> {
    this.loading ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(
      ([app, fb]) => {
        const firebaseApp = app.getApps().length
          ? app.getApp()
          : app.initializeApp(environment.firebase);
        const auth = fb.initializeAuth(firebaseApp, {
          persistence: fb.inMemoryPersistence,
          popupRedirectResolver: fb.browserPopupRedirectResolver,
        });
        this.ready = { auth, fb };
        return this.ready;
      },
    );
    this.loading.catch(() => (this.loading = null)); // allow a retry after a failed download
    return this.loading;
  }

  /** Resolves with the ID token. Rejects with the Firebase error (see `googleSignInErrorMessage`). */
  signIn(): Promise<string> {
    return this.ready ? this.popup(this.ready) : this.prepare().then((ready) => this.popup(ready));
  }

  private async popup({ auth, fb }: Ready): Promise<string> {
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await fb.signInWithPopup(auth, provider); // opens before any other await
    try {
      return await result.user.getIdToken();
    } finally {
      await fb.signOut(auth).catch(() => undefined);
    }
  }
}

/** Message for a failed Google sign-in, or null when the user simply closed the pop-up. */
export function googleSignInErrorMessage(error: unknown): string | null {
  if (isApiErrorResponse(error)) {
    return error.message; // the backend refused the account (e.g. blocked)
  }
  const code =
    typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Unable to reach Google. Check your connection and try again.';
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return 'Google sign-in is not available right now. Please use your email and password.';
    default:
      return 'Google sign-in failed. Please try again.';
  }
}
