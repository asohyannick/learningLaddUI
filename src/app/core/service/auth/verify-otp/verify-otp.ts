import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
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
import {
  OTP_PATTERN,
  applyServerErrors,
  trimmed,
} from '../../../../shared/validators/form-validators';
import { AuthService } from '../auth.service';

/** Seconds before "Resend code" can be used again. The backend also rate-limits. */
const RESEND_COOLDOWN_SECONDS = 60;

/** Step 2 of sign-up: enter the 6-digit code from the email. */
@Component({
  selector: 'app-verify-otp',
  imports: [AuthLayout, FieldError, FormAlert, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-otp.html',
})
export class VerifyOtp {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Email we sent the code to (set by the register page). Null if the page was opened directly. */
  protected readonly email = this.auth.pendingEmail;

  protected readonly form = this.fb.group({
    otpCode: ['', [Validators.required, Validators.pattern(OTP_PATTERN)]],
  });

  /** Only used when we do not know the email yet. */
  protected readonly resendForm = this.fb.group({
    email: ['', trimmed([Validators.required, Validators.email, Validators.maxLength(255)])],
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly resending = signal(false);
  protected readonly resendMessage = signal<string | null>(null);
  protected readonly resendError = signal<string | null>(null);
  protected readonly cooldown = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly inputClasses = inputClasses;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCooldown());
  }

  protected showError(control: 'otpCode' | 'email'): boolean {
    const c = control === 'otpCode' ? this.form.controls.otpCode : this.resendForm.controls.email;
    return c.invalid && c.touched;
  }

  /** Keeps only digits, at most 6, so pasting "123 456" also works. */
  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== input.value) {
      this.form.controls.otpCode.setValue(digits);
    }
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focus('#otpCode');
      return;
    }

    this.submitting.set(true);
    this.auth
      .verifyOtp({ otpCode: this.form.controls.otpCode.value })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigate(['/login'], { queryParams: { verified: 'true' } }),
        error: (error: unknown) => {
          this.serverError.set(applyServerErrors(this.form, error));
          this.form.controls.otpCode.setValue('');
          this.focus('#otpCode');
        },
      });
  }

  protected resend(): void {
    this.resendMessage.set(null);
    this.resendError.set(null);

    let email = this.email();
    if (!email) {
      if (this.resendForm.invalid) {
        this.resendForm.markAllAsTouched();
        this.focus('#resendEmail');
        return;
      }
      email = this.resendForm.controls.email.value.trim();
    }

    this.resending.set(true);
    this.auth
      .resendOtp({ email })
      .pipe(
        finalize(() => this.resending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => {
          this.auth.setPendingEmail(email);
          this.resendMessage.set(message || 'A new code is on its way.');
          this.startCooldown();
        },
        error: (error: unknown) => this.resendError.set(applyServerErrors(this.resendForm, error)),
      });
  }

  private startCooldown(): void {
    this.stopCooldown();
    this.cooldown.set(RESEND_COOLDOWN_SECONDS);
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((s) => s - 1);
      if (this.cooldown() <= 0) {
        this.stopCooldown();
      }
    }, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private focus(selector: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
