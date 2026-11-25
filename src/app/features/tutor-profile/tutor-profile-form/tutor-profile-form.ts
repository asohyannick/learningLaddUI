import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { GENDERS, Gender } from '../../../core/enum/global-enum-configuration';
import { ApiResponse, isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import {
  CreateTutorProfileRequest,
  TUTOR_PROFILE_PATTERNS,
  TutorProfileResponse,
  UpdateTutorProfileRequest,
} from '../tutor-profile.model';
import { TutorProfileService } from '../tutor-profile.service';

const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const LIST_LIMITS = {
  languages: [15, 100],
  hobbies: [20, 100],
  subjects: [30, 150],
  certifications: [20, 255],
} as const;
type ListField = keyof typeof LIST_LIMITS;

const KEEP_WHEN_BLANK = new Set([
  'firstName',
  'lastName',
  'dateOfBirth',
  'gender',
  'phoneNumber',
  'yearsOfExperience',
  'hourlyRate',
  'currency',
  'emergencyContactPhone',
  'linkedinUrl',
  'websiteUrl',
]);

function pastDate(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) return null;
  const today = new Date().toISOString().slice(0, 10);
  return value < today ? null : { pastDate: true };
}

function listValidator(field: ListField): ValidatorFn {
  const [maxItems, maxLength] = LIST_LIMITS[field];
  return (control) => {
    const items = splitList(control.value as string);
    if (items.length > maxItems) return { tooManyItems: { max: maxItems } };
    if (items.some((item) => item.length > maxLength)) return { itemTooLong: { max: maxLength } };
    return null;
  };
}

function yearsValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return { wholeNumber: true };
  const years = Number(value);
  if (years > 60) return { max: { max: 60 } };
  return null;
}

function rateValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (value.startsWith('-')) return { min: { min: 0 } };
  return /^\d{1,8}(\.\d{1,2})?$/.test(value) ? null : { moneyFormat: true };
}

function nameValidator(required: boolean): ValidatorFn {
  return trimmed([
    ...(required ? [Validators.required] : []),
    Validators.minLength(2),
    Validators.maxLength(255),
    Validators.pattern(TUTOR_PROFILE_PATTERNS.name),
  ]);
}

function optionalPattern(pattern: RegExp): ValidatorFn {
  return trimmed([Validators.pattern(pattern)]);
}

function splitList(value: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

type FieldName =
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'gender'
  | 'nationality'
  | 'phoneNumber'
  | 'description'
  | 'languages'
  | 'hobbies'
  | 'faculty'
  | 'department'
  | 'highestQualification'
  | 'fieldOfSpecialization'
  | 'subjects'
  | 'certifications'
  | 'yearsOfExperience'
  | 'hourlyRate'
  | 'currency'
  | 'addressLine'
  | 'city'
  | 'stateRegion'
  | 'postalCode'
  | 'country'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'emergencyContactRelationship'
  | 'linkedinUrl'
  | 'websiteUrl';

interface FieldConfig {
  name: FieldName;
  label: string;
  kind: 'text' | 'tel' | 'url' | 'date' | 'textarea' | 'gender';
  max?: number;
  placeholder?: string;
  hint?: string;
  patternMessage?: string;
  inputMode?: 'numeric' | 'decimal';
  wide?: boolean;
}

const PHONE_MESSAGE = 'Use 7–30 digits, spaces, brackets or dashes, with an optional leading +.';
const NAME_MESSAGE = 'Use letters, spaces, apostrophes, dots or hyphens.';

function listHint(field: ListField): string {
  return `Separate with commas, up to ${LIST_LIMITS[field][0]}.`;
}

const SECTIONS: readonly { title: string; fields: readonly FieldConfig[] }[] = [
  {
    title: 'About you',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', max: 30, placeholder: 'e.g. Dr.' },
      { name: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
      {
        name: 'firstName',
        label: 'First name',
        kind: 'text',
        max: 255,
        placeholder: 'e.g. Chidi',
        patternMessage: NAME_MESSAGE,
      },
      {
        name: 'lastName',
        label: 'Last name',
        kind: 'text',
        max: 255,
        placeholder: 'e.g. Eze',
        patternMessage: NAME_MESSAGE,
      },
      { name: 'gender', label: 'Gender', kind: 'gender' },
      {
        name: 'nationality',
        label: 'Nationality',
        kind: 'text',
        max: 100,
        placeholder: 'e.g. Nigerian',
      },
      {
        name: 'phoneNumber',
        label: 'Phone number',
        kind: 'tel',
        max: 30,
        placeholder: '+237 670 000 000',
        patternMessage: PHONE_MESSAGE,
      },
      {
        name: 'languages',
        label: 'Teaching languages',
        kind: 'text',
        placeholder: 'e.g. English, French',
        hint: listHint('languages'),
      },
      {
        name: 'description',
        label: 'Bio',
        kind: 'textarea',
        max: 5000,
        placeholder: 'How you teach, what you specialise in and who you like to work with',
        hint: 'Shown on your tutor profile.',
        wide: true,
      },
      {
        name: 'hobbies',
        label: 'Hobbies',
        kind: 'text',
        placeholder: 'e.g. Chess, Hiking',
        hint: listHint('hobbies'),
        wide: true,
      },
    ],
  },
  {
    title: 'Teaching',
    fields: [
      { name: 'faculty', label: 'Faculty', kind: 'text', max: 150, placeholder: 'e.g. Science' },
      {
        name: 'department',
        label: 'Department',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Mathematics',
      },
      {
        name: 'highestQualification',
        label: 'Highest qualification',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. MSc Computer Science',
      },
      {
        name: 'fieldOfSpecialization',
        label: 'Specialisation',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Machine Learning',
      },
      {
        name: 'subjects',
        label: 'Subjects you teach',
        kind: 'text',
        placeholder: 'e.g. Calculus, Linear Algebra',
        hint: listHint('subjects'),
        wide: true,
      },
      {
        name: 'certifications',
        label: 'Certifications',
        kind: 'text',
        placeholder: 'e.g. AWS Certified Developer, PGCE',
        hint: listHint('certifications'),
        wide: true,
      },
      {
        name: 'yearsOfExperience',
        label: 'Years of experience',
        kind: 'text',
        max: 2,
        placeholder: '0–60',
        inputMode: 'numeric',
      },
    ],
  },
  {
    title: 'Pricing',
    fields: [
      {
        name: 'hourlyRate',
        label: 'Hourly rate',
        kind: 'text',
        max: 11,
        placeholder: 'e.g. 25.00',
        inputMode: 'decimal',
      },
      {
        name: 'currency',
        label: 'Currency',
        kind: 'text',
        max: 3,
        placeholder: 'e.g. XAF, NGN, USD',
        hint: '3-letter currency code.',
        patternMessage: 'Use a 3-letter currency code, e.g. XAF.',
      },
    ],
  },
  {
    title: 'Address',
    fields: [
      { name: 'addressLine', label: 'Street address', kind: 'text', max: 255, wide: true },
      { name: 'city', label: 'City', kind: 'text', max: 100 },
      { name: 'stateRegion', label: 'State / region', kind: 'text', max: 100 },
      { name: 'postalCode', label: 'Postal code', kind: 'text', max: 20 },
      { name: 'country', label: 'Country', kind: 'text', max: 100 },
    ],
  },
  {
    title: 'Emergency contact',
    fields: [
      { name: 'emergencyContactName', label: 'Name', kind: 'text', max: 150 },
      {
        name: 'emergencyContactPhone',
        label: 'Phone',
        kind: 'tel',
        max: 30,
        patternMessage: PHONE_MESSAGE,
      },
      {
        name: 'emergencyContactRelationship',
        label: 'Relationship',
        kind: 'text',
        max: 50,
        placeholder: 'e.g. Spouse',
      },
    ],
  },
  {
    title: 'Links',
    fields: [
      {
        name: 'linkedinUrl',
        label: 'LinkedIn',
        kind: 'url',
        max: 258,
        placeholder: 'https://linkedin.com/in/…',
        patternMessage: 'The LinkedIn link must start with https://',
      },
      {
        name: 'websiteUrl',
        label: 'Website',
        kind: 'url',
        max: 258,
        placeholder: 'https://…',
        patternMessage: 'The website must start with http:// or https://',
      },
    ],
  },
];

export interface TutorProfileSaved {
  message: string;
  profile: TutorProfileResponse;
}

@Component({
  selector: 'app-tutor-profile-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-profile-form.html',
})
export class TutorProfileForm implements OnInit {
  private readonly profiles = inject(TutorProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly profileId = input<string | null>(null);
  readonly initial = input<TutorProfileResponse | null>(null);
  readonly canLoad = input(true);
  readonly done = output<TutorProfileSaved>();
  readonly cancelled = output<void>();

  protected readonly sections = SECTIONS;
  protected readonly genders = GENDERS;
  protected readonly inputClasses = inputClasses;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly isEdit = computed(() => !!this.profileId());
  protected readonly original = signal<TutorProfileResponse | null>(null);
  protected readonly blindEdit = computed(() => this.isEdit() && !this.original());

  private readonly currencyWithRate: ValidatorFn = (control) => {
    const rate = control.parent?.get('hourlyRate')?.value as string | undefined;
    if (!rate?.trim() || (control.value as string).trim()) return null;
    const original = this.original();
    const needed = !this.isEdit() || (original !== null && !original.currency);
    return needed ? { currencyRequired: true } : null;
  };

  protected readonly form = this.fb.group({
    title: ['', Validators.maxLength(30)],
    firstName: ['', nameValidator(true)],
    lastName: ['', nameValidator(true)],
    dateOfBirth: ['', pastDate],
    gender: ['' as Gender | ''],
    nationality: ['', Validators.maxLength(100)],
    phoneNumber: ['', optionalPattern(TUTOR_PROFILE_PATTERNS.phone)],
    description: ['', Validators.maxLength(5000)],
    languages: ['', listValidator('languages')],
    hobbies: ['', listValidator('hobbies')],
    faculty: ['', Validators.maxLength(150)],
    department: ['', Validators.maxLength(150)],
    highestQualification: ['', Validators.maxLength(150)],
    fieldOfSpecialization: ['', Validators.maxLength(150)],
    subjects: ['', listValidator('subjects')],
    certifications: ['', listValidator('certifications')],
    yearsOfExperience: ['', yearsValidator],
    hourlyRate: ['', rateValidator],
    currency: [
      '',
      [
        optionalPattern(TUTOR_PROFILE_PATTERNS.currency),
        (c: AbstractControl) => this.currencyWithRate(c),
      ],
    ],
    addressLine: ['', Validators.maxLength(255)],
    city: ['', Validators.maxLength(100)],
    stateRegion: ['', Validators.maxLength(100)],
    postalCode: ['', Validators.maxLength(20)],
    country: ['', Validators.maxLength(100)],
    emergencyContactName: ['', Validators.maxLength(150)],
    emergencyContactPhone: ['', optionalPattern(TUTOR_PROFILE_PATTERNS.phone)],
    emergencyContactRelationship: ['', Validators.maxLength(50)],
    linkedinUrl: ['', optionalPattern(TUTOR_PROFILE_PATTERNS.linkedinUrl)],
    websiteUrl: ['', optionalPattern(TUTOR_PROFILE_PATTERNS.websiteUrl)],
  });

  protected readonly picture = signal<File | null>(null);
  protected readonly picturePreview = signal<string | null>(null);
  protected readonly pictureError = signal<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private readonly namesRequired = signal(true);

  private readonly idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
    this.form.controls.hourlyRate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.currency.updateValueAndValidity({ emitEvent: false }));
  }

  ngOnInit(): void {
    const initial = this.initial();
    if (initial) {
      this.useProfile(initial);
    } else if (this.profileId() && this.canLoad()) {
      this.load();
    } else if (this.profileId()) {
      this.namesRequired.set(false);
      for (const name of ['firstName', 'lastName'] as const) {
        const control = this.form.controls[name];
        control.setValidators(nameValidator(false));
        control.updateValueAndValidity();
      }
    }
  }

  protected isRequired(name: FieldName): boolean {
    return (name === 'firstName' || name === 'lastName') && this.namesRequired();
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(): void {
    const id = this.profileId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.profiles
      .getProfile(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => this.useProfile(profile),
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this profile. Try again.',
          ),
      });
  }

  protected pickPicture(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.pictureError.set(null);
    if (file && !PICTURE_TYPES.includes(file.type)) {
      this.pictureError.set('Choose a JPEG, PNG, WebP or GIF image.');
      input.value = '';
      return;
    }
    if (file && file.size > MAX_PICTURE_BYTES) {
      this.pictureError.set('The picture must be 10 MB or smaller.');
      input.value = '';
      return;
    }
    this.revokePreview();
    this.picture.set(file);
    this.picturePreview.set(file ? URL.createObjectURL(file) : null);
  }

  protected clearPicture(input: HTMLInputElement): void {
    input.value = '';
    this.revokePreview();
    this.picture.set(null);
    this.picturePreview.set(null);
    this.pictureError.set(null);
  }

  protected submit(): void {
    this.serverError.set(null);
    this.form.controls.currency.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const files = { profilePicture: this.picture() ?? undefined };
    const id = this.profileId();
    if (id) {
      const changes = this.changedFields();
      if (!Object.keys(changes).length && !files.profilePicture) {
        this.serverError.set('Nothing to save: change a field or choose a picture first.');
        return;
      }
      this.save(this.profiles.updateProfile(id, changes, files));
    } else {
      this.save(this.profiles.createProfile(this.createPayload(), files, this.idempotencyKey));
    }
  }

  private save(request: Observable<ApiResponse<TutorProfileResponse>>): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit({ message: res.message, profile: res.data }),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private createPayload(): CreateTutorProfileRequest {
    const values = this.form.getRawValue();
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      const value = values[key].trim();
      if (value !== '') payload[key] = this.convert(key, value);
    }
    return payload as unknown as CreateTutorProfileRequest;
  }

  private changedFields(): UpdateTutorProfileRequest {
    const after = this.form.getRawValue();
    const original = this.original();
    const before = original ? this.toFormValue(original) : null;
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(after) as (keyof typeof after)[]) {
      const value = after[key].trim();
      const previous = before ? before[key].trim() : '';
      if (value === previous) continue;
      if (value === '' && (KEEP_WHEN_BLANK.has(key) || !before)) continue;
      changes[key] = this.convert(key, value);
    }
    return changes as UpdateTutorProfileRequest;
  }

  private convert(key: string, value: string): unknown {
    if (key === 'yearsOfExperience' || key === 'hourlyRate') return Number(value);
    if (key === 'currency') return value.toUpperCase();
    if (key in LIST_LIMITS) return splitList(value);
    return value;
  }

  private useProfile(profile: TutorProfileResponse): void {
    this.original.set(profile);
    this.form.reset(this.toFormValue(profile));
  }

  private toFormValue(p: TutorProfileResponse) {
    const list = (items?: string[]) => (items ?? []).join(', ');
    const number = (value?: number) => (value === undefined || value === null ? '' : String(value));
    return {
      title: p.title ?? '',
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      dateOfBirth: p.dateOfBirth ?? '',
      gender: (p.gender ?? '') as Gender | '',
      nationality: p.nationality ?? '',
      phoneNumber: p.phoneNumber ?? '',
      description: p.description ?? '',
      languages: list(p.languages),
      hobbies: list(p.hobbies),
      faculty: p.faculty ?? '',
      department: p.department ?? '',
      highestQualification: p.highestQualification ?? '',
      fieldOfSpecialization: p.fieldOfSpecialization ?? '',
      subjects: list(p.subjects),
      certifications: list(p.certifications),
      yearsOfExperience: number(p.yearsOfExperience),
      hourlyRate: number(p.hourlyRate),
      currency: p.currency ?? '',
      addressLine: p.addressLine ?? '',
      city: p.city ?? '',
      stateRegion: p.stateRegion ?? '',
      postalCode: p.postalCode ?? '',
      country: p.country ?? '',
      emergencyContactName: p.emergencyContactName ?? '',
      emergencyContactPhone: p.emergencyContactPhone ?? '',
      emergencyContactRelationship: p.emergencyContactRelationship ?? '',
      linkedinUrl: p.linkedinUrl ?? '',
      websiteUrl: p.websiteUrl ?? '',
    };
  }

  private revokePreview(): void {
    const url = this.picturePreview();
    if (url) URL.revokeObjectURL(url);
  }
}
