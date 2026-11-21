import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';

/**
 * Shows the first validation error of a form control, in red, once the user has left the field
 * or tried to submit (`markAllAsTouched()`). Give the input `aria-describedby` = `errorId`.
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p [id]="errorId()" class="mt-1.5 flex items-start gap-1.5 text-sm text-red-600">
        <svg
          class="mt-0.5 h-4 w-4 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clip-rule="evenodd"
          />
        </svg>
        <span>{{ text }}</span>
      </p>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  /** Used in the messages, e.g. "Email is required." */
  readonly label = input.required<string>();
  readonly errorId = input<string>();
  /** Message for a failed `Validators.pattern`. */
  readonly patternMessage = input<string>();

  /** Ticks on every value, status or touched change of the control. */
  private readonly controlEvents = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.events.pipe(startWith(null)))),
  );

  protected readonly message = computed(() => {
    this.controlEvents();
    const control = this.control();
    if (!control.invalid || !control.touched || !control.errors) {
      return null;
    }
    return this.describe(control.errors);
  });

  private describe(errors: ValidationErrors): string {
    const label = this.label();
    if (errors['server']) return String(errors['server']);
    if (errors['required']) return `${label} is required.`;
    if (errors['email']) return 'Enter a valid email address, like name@example.com.';
    if (errors['minlength']) {
      return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
    }
    if (errors['pattern']) return this.patternMessage() ?? `${label} is not valid.`;
    if (errors['passwordRules']) return 'Password does not meet all the requirements below.';
    if (errors['mismatch']) return 'Passwords do not match.';
    return `${label} is not valid.`;
  }
}
