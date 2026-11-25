import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../../../shared/reusable-components/auth-layout/auth-layout';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { inputClasses } from '../../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../../shared/validators/form-validators';
import { safeReturnUrl } from '../auth-session';
import { AuthService } from '../auth.service';
import { GoogleAuth } from '../google-auth/google-auth';

@Component({
  selector: 'app-login',
  imports: [AuthLayout, FieldError, FormAlert, GoogleAuth, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly returnUrl = input<string>();
  readonly verified = input<string>();
  readonly passwordReset = input<string>();
  readonly signedOut = input<string>();
  readonly expired = input<string>();
  readonly accountDeleted = input<string>();

  protected readonly notice = computed(() => {
    if (this.accountDeleted() === 'true') return 'Your account has been deleted.';
    if (this.passwordReset() === 'true')
      return 'Your password has been changed. Sign in with the new one.';
    if (this.verified() === 'true') return 'Your email is verified. Sign in to get started.';
    if (this.signedOut() === 'true') return 'You have been signed out.';
    return null;
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: [
      this.auth.pendingEmail() ?? '',
      trimmed([Validators.required, Validators.email, Validators.maxLength(256)]),
    ],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly needsVerification = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly inputClasses = inputClasses;

  protected showError(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    this.needsVerification.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }

    const email = this.form.controls.email.value.trim();
    this.submitting.set(true);
    this.auth
      .login({ email, password: this.form.controls.password.value })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const target = safeReturnUrl(this.returnUrl()) ?? this.auth.dashboardPath();
          void this.router.navigateByUrl(target, { replaceUrl: true });
        },
        error: (error: unknown) => {
          const message = applyServerErrors(this.form, error);
          this.serverError.set(message);
          this.needsVerification.set(/verify/i.test(message));
          this.form.controls.password.reset();
          this.host.nativeElement.querySelector<HTMLElement>('#password')?.focus();
        },
      });
  }

  protected goToVerification(): void {
    this.auth.setPendingEmail(this.form.controls.email.value.trim() || null);
    void this.router.navigate(['/verify-otp']);
  }
}
