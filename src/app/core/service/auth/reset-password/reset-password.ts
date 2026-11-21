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
import { isApiErrorResponse } from '../../../interface';
import { AuthLayout } from '../../../../shared/reusable-components/auth-layout/auth-layout';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { PasswordChecklist } from '../../../../shared/reusable-components/password-checklist/password-checklist';
import { inputClasses } from '../../../../shared/validators/field-styles';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  applyServerErrors,
  matchesControl,
  passwordStrength,
} from '../../../../shared/validators/form-validators';
import { AuthService } from '../auth.service';

/** Step 2 of a password reset, opened from the emailed link `/reset-password?token=…`. */
@Component({
  selector: 'app-reset-password',
  imports: [AuthLayout, FieldError, FormAlert, PasswordChecklist, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Query param from the reset link. */
  readonly token = input<string>();
  protected readonly hasToken = computed(() => (this.token() ?? '').trim().length > 0);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
        passwordStrength(),
      ],
    ],
    confirmPassword: [
      '',
      [
        Validators.required,
        Validators.maxLength(PASSWORD_MAX_LENGTH),
        matchesControl('newPassword'),
      ],
    ],
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** The link itself was refused (used, expired or replaced), not one of the fields. */
  protected readonly linkRejected = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly inputClasses = inputClasses;

  constructor() {
    // Re-check "confirm password" whenever the new password changes.
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected showError(name: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    this.linkRejected.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }

    this.submitting.set(true);
    this.auth
      .resetPassword((this.token() ?? '').trim(), this.form.getRawValue())
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          void this.router.navigate(['/login'], {
            queryParams: { passwordReset: 'true' },
            replaceUrl: true,
          }),
        error: (error: unknown) => {
          this.serverError.set(applyServerErrors(this.form, error));
          this.linkRejected.set(isApiErrorResponse(error) && !error.errors?.length);
        },
      });
  }
}
