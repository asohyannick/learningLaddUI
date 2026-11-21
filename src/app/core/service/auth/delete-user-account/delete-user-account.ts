import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../../shared/validators/form-validators';
import { AuthService } from '../auth.service';

/**
 * Dialog: deletes the signed-in user's own account after they confirm their password.
 * Every session ends, so the user lands on the login page afterwards.
 */
@Component({
  selector: 'app-delete-user-account',
  imports: [FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-user-account.html',
})
export class DeleteUserAccount {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly cancelled = output<void>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required, Validators.maxLength(128)]],
    reason: ['', trimmed([Validators.maxLength(500)])],
  });
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly inputClasses = inputClasses;

  protected showError(name: 'password' | 'reason'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const reason = this.form.controls.reason.value.trim();
    this.submitting.set(true);
    this.auth
      .deleteAccount({ password: this.form.controls.password.value, reason: reason || null })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          void this.router.navigate(['/login'], {
            queryParams: { accountDeleted: 'true' },
            replaceUrl: true,
          }),
        error: (error: unknown) => {
          this.serverError.set(applyServerErrors(this.form, error));
          this.form.controls.password.reset();
        },
      });
  }
}
