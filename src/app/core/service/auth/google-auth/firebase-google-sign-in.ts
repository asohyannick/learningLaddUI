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

export function isFirebaseConfigured(config: FirebaseOptions = environment.firebase): boolean {
  return [config.apiKey, config.authDomain, config.projectId, config.appId].every(
    (value) => typeof value === 'string' && value.length > 0 && !value.startsWith('<'),
  );
}

@Injectable({ providedIn: 'root' })
export class FirebaseGoogleSignIn {
  readonly configured = isFirebaseConfigured();
  private ready: Ready | null = null;
  private loading: Promise<Ready> | null = null;

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
    this.loading.catch(() => (this.loading = null));
    return this.loading;
  }

  signIn(): Promise<string> {
    return this.ready ? this.popup(this.ready) : this.prepare().then((ready) => this.popup(ready));
  }

  private async popup({ auth, fb }: Ready): Promise<string> {
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await fb.signInWithPopup(auth, provider);
    try {
      return await result.user.getIdToken();
    } finally {
      await fb.signOut(auth).catch(() => undefined);
    }
  }
}

export function googleSignInErrorMessage(error: unknown): string | null {
  if (isApiErrorResponse(error)) {
    return error.message;
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
