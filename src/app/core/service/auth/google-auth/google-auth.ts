import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { safeReturnUrl } from '../auth-session';
import { AuthService } from '../auth.service';
import { FirebaseGoogleSignIn, googleSignInErrorMessage } from './firebase-google-sign-in';

/**
 * "Continue with Google" button for the login and register pages.
 * Google pop-up (Firebase) → ID token → `POST /auth/google` → session → dashboard.
 * Hidden when Firebase is not configured in the environment file.
 */
@Component({
  selector: 'app-google-auth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './google-auth.html',
})
export class GoogleAuth {
  private readonly auth = inject(AuthService);
  private readonly google = inject(FirebaseGoogleSignIn);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Page to open after signing in (from the login page's `returnUrl`). */
  readonly returnUrl = input<string>();

  protected readonly available = this.google.configured;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.available) {
      // Download the SDK now, so the pop-up can open the moment the button is clicked.
      afterNextRender(() => void this.google.prepare().catch(() => undefined));
    }
  }

  protected async signIn(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.error.set(null);
    this.busy.set(true);

    let idToken: string;
    try {
      idToken = await this.google.signIn();
    } catch (error) {
      this.error.set(googleSignInErrorMessage(error));
      this.busy.set(false);
      return;
    }

    this.auth
      .loginWithGoogle(idToken)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const target = safeReturnUrl(this.returnUrl()) ?? this.auth.dashboardPath();
          void this.router.navigateByUrl(target, { replaceUrl: true });
        },
        error: (error: unknown) => this.error.set(googleSignInErrorMessage(error)),
      });
  }
}
