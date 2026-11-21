import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayout } from '../../../../shared/reusable-components/auth-layout/auth-layout';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { inputClasses } from '../../../../shared/validators/field-styles';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PERSON_NAME_PATTERN,
  applyServerErrors,
  matchesControl,
  passwordStrength,
  trimmed,
} from '../../../../shared/validators/form-validators';
import { AuthService } from '../auth.service';

const NAME_VALIDATORS = trimmed([
  Validators.required,
  Validators.minLength(2),
  Validators.maxLength(255),
  Validators.pattern(PERSON_NAME_PATTERN),
]);

/** Sign-up page: creates a student account, then sends the user to enter the emailed code. */
@Component({
  selector: 'app-register',
  imports: [AuthLayout, FieldError, FormAlert, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', NAME_VALIDATORS],
    lastName: ['', NAME_VALIDATORS],
    email: ['', trimmed([Validators.required, Validators.email, Validators.maxLength(255)])],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
        passwordStrength(),
      ],
    ],
    confirmPassword: ['', [Validators.required, matchesControl('password')]],
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly inputClasses = inputClasses;

  private readonly password = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  /** Live checklist under the password field. */
  protected readonly passwordChecks = computed(() => {
    const value = this.password();
    return PASSWORD_RULES.map((rule) => ({ label: rule.label, met: rule.test(value) }));
  });

  constructor() {
    // Re-check "confirm password" whenever the password changes.
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity());
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const { firstName, lastName, email, password } = this.form.getRawValue();
    const body = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    };

    this.submitting.set(true);
    this.auth
      .register(body)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.auth.setPendingEmail(body.email);
          void this.router.navigate(['/verify-otp']);
        },
        error: (error: unknown) => {
          this.serverError.set(applyServerErrors(this.form, error));
          this.focusFirstInvalid();
        },
      });
  }

  private focusFirstInvalid(): void {
    this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid')?.focus();
  }
}
