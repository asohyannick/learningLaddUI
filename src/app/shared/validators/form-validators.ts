import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { isApiErrorResponse } from '../../core/interface';

export const PERSON_NAME_PATTERN = /^[\p{L}][\p{L}\p{M} '.-]*$/u;

export const OTP_PATTERN = /^\d{6}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export interface PasswordRule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    key: 'length',
    label: `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`,
    test: (v) => v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH,
  },
  { key: 'lowercase', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'uppercase', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'digit', label: 'A number', test: (v) => /\d/.test(v) },
  {
    key: 'special',
    label: 'A special character (e.g. ! @ # ?)',
    test: (v) => /[^A-Za-z0-9\s]/.test(v),
  },
];

export function trimmed(validators: ValidatorFn[]): ValidatorFn {
  const validate = Validators.compose(validators) ?? (() => null);
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : control.value;
    return validate(new FormControl(value));
  };
}

export function passwordStrength(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value : '';
    if (!value) {
      return null;
    }
    const missing = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.key);
    return missing.length ? { passwordRules: { missing } } : null;
  };
}

export function matchesControl(otherName: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherName);
    if (!other || !control.value) {
      return null;
    }
    return control.value === other.value ? null : { mismatch: true };
  };
}

export function applyServerErrors(form: FormGroup, error: unknown): string {
  if (!isApiErrorResponse(error)) {
    return 'Something went wrong. Please try again.';
  }
  for (const fieldError of error.errors ?? []) {
    const control = form.get(fieldError.field);
    if (control) {
      control.setErrors({ ...control.errors, server: fieldError.message });
      control.markAsTouched();
    }
  }
  return error.message;
}
