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
  CreateStudentProfileRequest,
  STUDENT_PROFILE_PATTERNS,
  StudentProfileResponse,
  UpdateStudentProfileRequest,
} from '../student-profile.model';
import { StudentProfileService } from '../student-profile.service';

const MAX_HOBBIES = 20;
const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const KEEP_WHEN_BLANK = new Set([
  'firstName',
  'lastName',
  'dateOfBirth',
  'gender',
  'phoneNumber',
  'currentLevel',
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

function hobbyList(control: AbstractControl): ValidationErrors | null {
  const items = splitHobbies(control.value as string);
  if (items.length > MAX_HOBBIES) return { tooManyHobbies: true };
  if (items.some((item) => item.length > 100)) return { hobbyTooLong: true };
  return null;
}

function nameValidator(required: boolean): ValidatorFn {
  return trimmed([
    ...(required ? [Validators.required] : []),
    Validators.minLength(2),
    Validators.maxLength(255),
    Validators.pattern(STUDENT_PROFILE_PATTERNS.name),
  ]);
}

function optionalPattern(pattern: RegExp): ValidatorFn {
  return trimmed([Validators.pattern(pattern)]);
}

function splitHobbies(value: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

type FieldName =
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'gender'
  | 'nationality'
  | 'phoneNumber'
  | 'description'
  | 'hobbies'
  | 'addressLine'
  | 'city'
  | 'stateRegion'
  | 'postalCode'
  | 'country'
  | 'faculty'
  | 'department'
  | 'programOfStudy'
  | 'currentLevel'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'emergencyContactRelationship'
  | 'linkedinUrl'
  | 'websiteUrl';

interface FieldConfig {
  name: FieldName;
  label: string;
  kind: 'text' | 'tel' | 'url' | 'date' | 'textarea' | 'gender' | 'level';
  max?: number;
  placeholder?: string;
  hint?: string;
  patternMessage?: string;
  wide?: boolean;
}

const PHONE_MESSAGE = 'Use 7–30 digits, spaces, brackets or dashes, with an optional leading +.';

const SECTIONS: readonly { title: string; fields: readonly FieldConfig[] }[] = [
  {
    title: 'About you',
    fields: [
      {
        name: 'firstName',
        label: 'First name',
        kind: 'text',
        max: 255,
        placeholder: 'e.g. Amara',
        patternMessage: 'Use letters, spaces, apostrophes, dots or hyphens.',
      },
      {
        name: 'lastName',
        label: 'Last name',
        kind: 'text',
        max: 255,
        placeholder: 'e.g. Nkem',
        patternMessage: 'Use letters, spaces, apostrophes, dots or hyphens.',
      },
      { name: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
      { name: 'gender', label: 'Gender', kind: 'gender' },
      {
        name: 'nationality',
        label: 'Nationality',
        kind: 'text',
        max: 100,
        placeholder: 'e.g. Cameroonian',
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
        name: 'description',
        label: 'About me',
        kind: 'textarea',
        max: 5000,
        placeholder: 'A few lines about your interests and goals',
        wide: true,
      },
      {
        name: 'hobbies',
        label: 'Hobbies',
        kind: 'text',
        placeholder: 'e.g. Football, Chess, Music',
        hint: `Separate with commas, up to ${MAX_HOBBIES}.`,
        wide: true,
      },
    ],
  },
  {
    title: 'Studies',
    fields: [
      { name: 'faculty', label: 'Faculty', kind: 'text', max: 150, placeholder: 'e.g. Science' },
      {
        name: 'department',
        label: 'Department',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Computer Science',
      },
      {
        name: 'programOfStudy',
        label: 'Programme',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. BSc Software Engineering',
      },
      { name: 'currentLevel', label: 'Year of study', kind: 'level' },
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
        placeholder: 'e.g. Mother',
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

export interface StudentProfileSaved {
  message: string;
  profile: StudentProfileResponse;
}

@Component({
  selector: 'app-student-profile-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-profile-form.html',
})
export class StudentProfileForm implements OnInit {
  private readonly profiles = inject(StudentProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly profileId = input<string | null>(null);
  readonly initial = input<StudentProfileResponse | null>(null);
  readonly canLoad = input(true);
  readonly done = output<StudentProfileSaved>();
  readonly cancelled = output<void>();

  protected readonly sections = SECTIONS;
  protected readonly genders = GENDERS;
  protected readonly levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
  protected readonly inputClasses = inputClasses;
  protected readonly maxHobbies = MAX_HOBBIES;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly isEdit = computed(() => !!this.profileId());
  protected readonly blindEdit = computed(() => this.isEdit() && !this.original());

  protected readonly form = this.fb.group({
    firstName: ['', nameValidator(true)],
    lastName: ['', nameValidator(true)],
    dateOfBirth: ['', pastDate],
    gender: ['' as Gender | ''],
    nationality: ['', Validators.maxLength(100)],
    phoneNumber: ['', optionalPattern(STUDENT_PROFILE_PATTERNS.phone)],
    description: ['', Validators.maxLength(5000)],
    hobbies: ['', hobbyList],
    addressLine: ['', Validators.maxLength(255)],
    city: ['', Validators.maxLength(100)],
    stateRegion: ['', Validators.maxLength(100)],
    postalCode: ['', Validators.maxLength(20)],
    country: ['', Validators.maxLength(100)],
    faculty: ['', Validators.maxLength(150)],
    department: ['', Validators.maxLength(150)],
    programOfStudy: ['', Validators.maxLength(150)],
    currentLevel: [''],
    emergencyContactName: ['', Validators.maxLength(150)],
    emergencyContactPhone: ['', optionalPattern(STUDENT_PROFILE_PATTERNS.phone)],
    emergencyContactRelationship: ['', Validators.maxLength(50)],
    linkedinUrl: ['', optionalPattern(STUDENT_PROFILE_PATTERNS.linkedinUrl)],
    websiteUrl: ['', optionalPattern(STUDENT_PROFILE_PATTERNS.websiteUrl)],
  });

  protected readonly picture = signal<File | null>(null);
  protected readonly picturePreview = signal<string | null>(null);
  protected readonly pictureError = signal<string | null>(null);

  protected readonly original = signal<StudentProfileResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
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

  private readonly namesRequired = signal(true);

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

  private save(request: Observable<ApiResponse<StudentProfileResponse>>): void {
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

  private createPayload(): CreateStudentProfileRequest {
    const payload = this.toPayload(this.form.getRawValue());
    return { ...payload, firstName: payload.firstName ?? '', lastName: payload.lastName ?? '' };
  }

  private changedFields(): UpdateStudentProfileRequest {
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
    return changes as UpdateStudentProfileRequest;
  }

  private toPayload(values: ReturnType<typeof this.form.getRawValue>): UpdateStudentProfileRequest {
    const payload: Record<string, unknown> = {};
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      const value = values[key].trim();
      if (value !== '') payload[key] = this.convert(key, value);
    }
    return payload as UpdateStudentProfileRequest;
  }

  private convert(key: string, value: string): unknown {
    if (key === 'currentLevel') return Number(value);
    if (key === 'hobbies') return splitHobbies(value);
    return value;
  }

  private useProfile(profile: StudentProfileResponse): void {
    this.original.set(profile);
    this.form.reset(this.toFormValue(profile));
  }

  private toFormValue(p: StudentProfileResponse) {
    return {
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      dateOfBirth: p.dateOfBirth ?? '',
      gender: (p.gender ?? '') as Gender | '',
      nationality: p.nationality ?? '',
      phoneNumber: p.phoneNumber ?? '',
      description: p.description ?? '',
      hobbies: (p.hobbies ?? []).join(', '),
      addressLine: p.addressLine ?? '',
      city: p.city ?? '',
      stateRegion: p.stateRegion ?? '',
      postalCode: p.postalCode ?? '',
      country: p.country ?? '',
      faculty: p.faculty ?? '',
      department: p.department ?? '',
      programOfStudy: p.programOfStudy ?? '',
      currentLevel: p.currentLevel ? String(p.currentLevel) : '',
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
