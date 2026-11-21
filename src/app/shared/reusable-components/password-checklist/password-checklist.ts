import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PASSWORD_RULES } from '../../validators/form-validators';

/** Live list of the password rules under a password field: green when met, red after an error. */
@Component({
  selector: 'app-password-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul [id]="listId()" class="mt-2 grid gap-1 text-xs sm:grid-cols-2">
      @for (check of checks(); track check.label) {
        <li
          class="flex items-center gap-1.5"
          [class]="check.met ? 'text-emerald-700' : showErrors() ? 'text-red-600' : 'text-muted'"
        >
          <span aria-hidden="true">{{ check.met ? '✓' : '•' }}</span>
          {{ check.label }}
          <span class="sr-only">{{ check.met ? '(met)' : '(not met)' }}</span>
        </li>
      }
    </ul>
  `,
})
export class PasswordChecklist {
  readonly value = input.required<string>();
  /** Turns unmet rules red (pass true once the field shows an error). */
  readonly showErrors = input(false);
  /** Referenced by the input's `aria-describedby`. */
  readonly listId = input('password-rules');

  protected readonly checks = computed(() => {
    const value = this.value() ?? '';
    return PASSWORD_RULES.map((rule) => ({ label: rule.label, met: rule.test(value) }));
  });
}
