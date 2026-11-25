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
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../../../shared/reusable-components/auth-layout/auth-layout';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { createCountdown } from '../../../../shared/utils/countdown';
import { inputClasses } from '../../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../../shared/validators/form-validators';
import { AuthService } from '../auth.service';

const RESEND_COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-forgot-password',
  imports: [AuthLayout, FieldError, FormAlert, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: [
      this.auth.pendingEmail() ?? '',
      trimmed([Validators.required, Validators.email, Validators.maxLength(256)]),
    ],
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly sentMessage = signal<string | null>(null);
  protected readonly sentTo = signal('');
  protected readonly cooldown = createCountdown(this.destroyRef);
  protected readonly inputClasses = inputClasses;

  protected showError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('#email')?.focus();
      return;
    }

    const email = this.form.controls.email.value.trim();
    this.submitting.set(true);
    this.auth
      .forgotPassword({ email })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => {
          this.sentTo.set(email);
          this.sentMessage.set(message || 'Check your inbox for a link to reset your password.');
          this.cooldown.start(RESEND_COOLDOWN_SECONDS);
        },
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  protected changeEmail(): void {
    this.sentMessage.set(null);
    this.serverError.set(null);
  }
}
