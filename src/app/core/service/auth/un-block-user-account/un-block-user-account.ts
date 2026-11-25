import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { IUserResponse } from '../../../interface';
import { FieldError } from '../../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../../shared/validators/form-validators';
import { UserAdminService, displayName } from '../user-admin.service';

@Component({
  selector: 'app-un-block-user-account',
  imports: [FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './un-block-user-account.html',
})
export class UnBlockUserAccount {
  private readonly users = inject(UserAdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<IUserResponse>();
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly name = computed(() => displayName(this.user()));
  protected readonly form = inject(FormBuilder).nonNullable.group({
    reason: [
      '',
      trimmed([Validators.required, Validators.minLength(5), Validators.maxLength(500)]),
    ],
  });
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly inputClasses = inputClasses;

  protected get showError(): boolean {
    const control = this.form.controls.reason;
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.users
      .unblockUser(this.user().id, { reason: this.form.controls.reason.value.trim() })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => this.done.emit(message),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }
}
