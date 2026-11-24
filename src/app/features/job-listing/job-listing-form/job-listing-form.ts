import { JobPhoto } from '../job-photo/job-photo';
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
import { Observable, finalize, map, of, switchMap } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import {
  CreateJobListingRequestDto,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  EmploymentType,
  ExperienceLevel,
  JOB_LIST_LIMITS,
  JOB_LISTING_PATTERNS,
  JOB_STATUSES,
  JobListField,
  JobListingResponseDto,
  JobStatus,
  SALARY_PERIODS,
  SalaryPeriod,
  UpdateJobListingRequestDto,
  WORK_MODES,
  WorkMode,
} from '../job-listing.model';
import { JobListingService, todayIso } from '../job-listing.service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Splits a "one per line" field into trimmed, non-empty entries. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listValidator(field: JobListField): ValidatorFn {
  const [maxItems, maxLength] = JOB_LIST_LIMITS[field];
  return (control) => {
    const items = splitLines(control.value as string);
    if (items.length > maxItems) return { tooManyItems: { max: maxItems } };
    if (items.some((item) => item.length > maxLength)) return { itemTooLong: { max: maxLength } };
    return null;
  };
}

/** Whole number between `min` and `max`. */
function wholeNumber(min: number, max: number): ValidatorFn {
  return (control) => {
    const value = (control.value as string).trim();
    if (!value) return null;
    if (!/^\d+$/.test(value)) return { wholeNumber: true };
    const n = Number(value);
    if (n < min) return { min: { min } };
    return n > max ? { max: { max } } : null;
  };
}

/** ≥ 0, at most 10 digits before the point and 2 after (`@Digits(integer = 10, fraction = 2)`). */
function money(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (value.startsWith('-')) return { min: { min: 0 } };
  return /^\d{1,10}(\.\d{1,2})?$/.test(value) ? null : { moneyFormat: { integer: 10 } };
}

/** Maximum salary not below the minimum. */
function salaryRange(control: AbstractControl): ValidationErrors | null {
  const min = Number(control.parent?.get('salaryMin')?.value || NaN);
  const max = Number(control.value || NaN);
  return !Number.isNaN(min) && !Number.isNaN(max) && min > max ? { salaryRange: true } : null;
}

/** Expected start on or after the application deadline. */
function startAfterDeadline(control: AbstractControl): ValidationErrors | null {
  const deadline = control.parent?.get('applicationDeadline')?.value as string | undefined;
  const start = control.value as string;
  return deadline && start && start < deadline ? { beforeDeadline: true } : null;
}

type TextField =
  | 'title'
  | 'positionTitle'
  | 'shortDescription'
  | 'description'
  | 'responsibilities'
  | 'requirements'
  | 'faculty'
  | 'department'
  | 'reportsTo'
  | 'employmentType'
  | 'workMode'
  | 'experienceLevel'
  | 'minimumYearsExperience'
  | 'minimumEducation'
  | 'numberOfVacancies'
  | 'city'
  | 'stateRegion'
  | 'country'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'benefits'
  | 'salaryMin'
  | 'salaryMax'
  | 'currency'
  | 'salaryPeriod'
  | 'applicationDeadline'
  | 'expectedStartDate'
  | 'contactEmail'
  | 'applicationInstructions'
  | 'jobPhotoUrl'
  | 'status';

interface FieldConfig {
  name: TextField;
  label: string;
  kind: 'text' | 'email' | 'date' | 'textarea' | 'select';
  max?: number;
  rows?: number;
  placeholder?: string;
  hint?: string;
  patternMessage?: string;
  inputMode?: 'numeric' | 'decimal' | 'url';
  options?: readonly string[];
  /** Label of the empty choice; leave out to hide it. */
  emptyLabel?: string;
  required?: boolean;
  wide?: boolean;
  /** Only shown when editing. */
  editOnly?: boolean;
}

const LIST_HINT = 'One per line.';

const SECTIONS: readonly { title: string; fields: readonly FieldConfig[] }[] = [
  {
    title: 'The role',
    fields: [
      {
        name: 'title',
        label: 'Job title',
        kind: 'text',
        max: 255,
        placeholder: 'e.g. Lecturer in Mathematics',
        required: true,
        wide: true,
      },
      {
        name: 'status',
        label: 'Status',
        kind: 'select',
        options: JOB_STATUSES,
        hint: 'Only open listings appear on the website and accept applications.',
        editOnly: true,
      },
      {
        name: 'positionTitle',
        label: 'Position / grade',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Senior Lecturer',
      },
      {
        name: 'shortDescription',
        label: 'Summary',
        kind: 'textarea',
        rows: 2,
        max: 500,
        placeholder: 'One or two lines shown on the job card',
        wide: true,
      },
      {
        name: 'description',
        label: 'Job description',
        kind: 'textarea',
        rows: 6,
        max: 20_000,
        placeholder: 'What the role is about, the team and why it matters',
        required: true,
        wide: true,
      },
      {
        name: 'responsibilities',
        label: 'Responsibilities',
        kind: 'textarea',
        rows: 4,
        max: 10_000,
        wide: true,
      },
      {
        name: 'requirements',
        label: 'Requirements',
        kind: 'textarea',
        rows: 4,
        max: 10_000,
        wide: true,
      },
    ],
  },
  {
    title: 'Team',
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
        name: 'reportsTo',
        label: 'Reports to',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Head of Department',
      },
    ],
  },
  {
    title: 'Type & experience',
    fields: [
      {
        name: 'employmentType',
        label: 'Employment type',
        kind: 'select',
        options: EMPLOYMENT_TYPES,
        required: true,
      },
      { name: 'workMode', label: 'Work mode', kind: 'select', options: WORK_MODES, required: true },
      {
        name: 'experienceLevel',
        label: 'Experience level',
        kind: 'select',
        options: EXPERIENCE_LEVELS,
        emptyLabel: 'Not specified',
      },
      {
        name: 'minimumYearsExperience',
        label: 'Minimum years of experience',
        kind: 'text',
        max: 2,
        placeholder: 'e.g. 3',
        inputMode: 'numeric',
      },
      {
        name: 'minimumEducation',
        label: 'Minimum education',
        kind: 'text',
        max: 100,
        placeholder: "e.g. Master's degree",
      },
      {
        name: 'numberOfVacancies',
        label: 'Vacancies',
        kind: 'text',
        max: 4,
        placeholder: '1',
        inputMode: 'numeric',
        hint: '1 when left blank.',
      },
    ],
  },
  {
    title: 'Location',
    fields: [
      { name: 'city', label: 'City', kind: 'text', max: 100 },
      { name: 'stateRegion', label: 'State / region', kind: 'text', max: 100 },
      { name: 'country', label: 'Country', kind: 'text', max: 100 },
    ],
  },
  {
    title: 'Skills & benefits',
    fields: [
      {
        name: 'skills',
        label: 'Skills',
        kind: 'textarea',
        rows: 4,
        hint: `${LIST_HINT} Up to 30.`,
      },
      {
        name: 'certifications',
        label: 'Certifications',
        kind: 'textarea',
        rows: 4,
        hint: `${LIST_HINT} Up to 20.`,
      },
      {
        name: 'languages',
        label: 'Languages',
        kind: 'textarea',
        rows: 3,
        hint: `${LIST_HINT} Up to 10.`,
      },
      {
        name: 'benefits',
        label: 'Benefits',
        kind: 'textarea',
        rows: 3,
        hint: `${LIST_HINT} Up to 20.`,
      },
    ],
  },
  {
    title: 'Salary',
    fields: [
      {
        name: 'salaryMin',
        label: 'Minimum salary',
        kind: 'text',
        max: 13,
        placeholder: 'e.g. 250000',
        inputMode: 'decimal',
      },
      {
        name: 'salaryMax',
        label: 'Maximum salary',
        kind: 'text',
        max: 13,
        placeholder: 'e.g. 400000',
        inputMode: 'decimal',
      },
      {
        name: 'currency',
        label: 'Currency',
        kind: 'text',
        max: 3,
        placeholder: 'USD',
        hint: '3-letter code. USD when left blank.',
        patternMessage: 'Use a 3-letter currency code, e.g. XAF.',
      },
      {
        name: 'salaryPeriod',
        label: 'Paid per',
        kind: 'select',
        options: SALARY_PERIODS,
        required: true,
      },
    ],
  },
  {
    title: 'Applications',
    fields: [
      { name: 'applicationDeadline', label: 'Application deadline', kind: 'date' },
      { name: 'expectedStartDate', label: 'Expected start date', kind: 'date' },
      {
        name: 'contactEmail',
        label: 'Contact email',
        kind: 'email',
        max: 255,
        placeholder: 'careers@example.org',
        wide: true,
      },
      {
        name: 'applicationInstructions',
        label: 'How to apply',
        kind: 'textarea',
        rows: 3,
        max: 5000,
        placeholder: 'Documents to include, interview steps…',
        wide: true,
      },
    ],
  },
];

const LIST_FIELDS = new Set<string>(['skills', 'certifications', 'languages', 'benefits']);
const NUMBER_FIELDS = new Set<string>([
  'minimumYearsExperience',
  'numberOfVacancies',
  'salaryMin',
  'salaryMax',
]);
/** Blank means "keep" for these on edit: the API cannot clear them. */
const KEEP_WHEN_BLANK = new Set<string>([
  ...NUMBER_FIELDS,
  'title',
  'description',
  'currency',
  'applicationDeadline',
  'expectedStartDate',
  'jobPhotoUrl',
  'experienceLevel',
]);

export interface JobListingSaved {
  message: string;
  listing: JobListingResponseDto;
}

/**
 * Dialog to post a job (`POST /job-listing`) or update one (`PATCH /job-listing/{id}`), with an
 * optional photo. New listings are drafts; "Publish now" opens them right after saving.
 * An update only sends the fields that changed.
 */
@Component({
  selector: 'app-job-listing-form',
  imports: [JobPhoto, EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-listing-form.html',
})
export class JobListingForm implements OnInit {
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Listing to update; leave empty to post a new one. */
  readonly jobListingId = input<string | null>(null);
  readonly done = output<JobListingSaved>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;
  protected readonly isEdit = computed(() => !!this.jobListingId());
  protected readonly sections = computed(() =>
    SECTIONS.map((s) => ({ ...s, fields: s.fields.filter((f) => !f.editOnly || this.isEdit()) })),
  );
  protected readonly original = signal<JobListingResponseDto | null>(null);
  protected readonly today = todayIso();

  protected readonly form = this.fb.group({
    title: ['', trimmed([Validators.required, Validators.minLength(3), Validators.maxLength(255)])],
    status: ['' as JobStatus | ''],
    positionTitle: ['', Validators.maxLength(150)],
    shortDescription: ['', Validators.maxLength(500)],
    description: ['', trimmed([Validators.required, Validators.maxLength(20_000)])],
    responsibilities: ['', Validators.maxLength(10_000)],
    requirements: ['', Validators.maxLength(10_000)],
    faculty: ['', Validators.maxLength(150)],
    department: ['', Validators.maxLength(150)],
    reportsTo: ['', Validators.maxLength(150)],
    employmentType: [EmploymentType.FULL_TIME as EmploymentType | ''],
    workMode: [WorkMode.ON_SITE as WorkMode | ''],
    experienceLevel: ['' as ExperienceLevel | ''],
    minimumYearsExperience: ['', wholeNumber(0, 60)],
    minimumEducation: ['', Validators.maxLength(100)],
    numberOfVacancies: ['', wholeNumber(1, 1000)],
    city: ['', Validators.maxLength(100)],
    stateRegion: ['', Validators.maxLength(100)],
    country: ['', Validators.maxLength(100)],
    skills: ['', listValidator('skills')],
    certifications: ['', listValidator('certifications')],
    languages: ['', listValidator('languages')],
    benefits: ['', listValidator('benefits')],
    salaryMin: ['', money],
    salaryMax: ['', [money, salaryRange]],
    currency: ['', trimmed([Validators.pattern(/^[A-Za-z]{3}$/)])],
    salaryPeriod: [SalaryPeriod.MONTHLY as SalaryPeriod | ''],
    applicationDeadline: ['', (c: AbstractControl) => this.deadlineRule(c)],
    expectedStartDate: ['', startAfterDeadline],
    contactEmail: ['', trimmed([Validators.email, Validators.maxLength(255)])],
    applicationInstructions: ['', Validators.maxLength(5000)],
    jobPhotoUrl: [
      '',
      trimmed([Validators.pattern(JOB_LISTING_PATTERNS.photoUrl), Validators.maxLength(1024)]),
    ],
    salaryVisible: [true],
    publishNow: [false],
  });

  protected readonly photo = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly photoError = signal<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      const url = this.photoPreview();
      if (url) URL.revokeObjectURL(url);
    });
    const recheck = (source: AbstractControl, target: AbstractControl) =>
      source.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => target.updateValueAndValidity());
    const c = this.form.controls;
    recheck(c.salaryMin, c.salaryMax);
    recheck(c.applicationDeadline, c.expectedStartDate);
  }

  ngOnInit(): void {
    if (this.jobListingId()) this.load();
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(): void {
    const id = this.jobListingId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.jobs
      .getJobListing(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (listing) => {
          this.original.set(listing);
          this.form.reset(this.toFormValue(listing));
        },
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this listing. Try again.',
          ),
      });
  }

  protected pickPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.photoError.set(null);
    if (file && !PHOTO_TYPES.includes(file.type)) {
      this.photoError.set('Choose a JPEG, PNG or WebP image.');
      input.value = '';
      return;
    }
    if (file && file.size > MAX_PHOTO_BYTES) {
      this.photoError.set('The photo must be 5 MB or smaller.');
      input.value = '';
      return;
    }
    this.setPhoto(file);
  }

  protected clearPhoto(input: HTMLInputElement): void {
    input.value = '';
    this.setPhoto(null);
    this.photoError.set(null);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.jobListingId();
    const photo = this.photo();
    if (id) {
      const changes = this.changedFields();
      if (!Object.keys(changes).length && !photo) {
        this.serverError.set('Nothing to save: change a field or choose a photo first.');
        return;
      }
      this.save(
        this.jobs.updateJobListing(id, changes, photo).pipe(
          map((res) => ({
            message: `Changes to “${res.data.title}” were saved.`,
            listing: res.data,
          })),
        ),
      );
      return;
    }
    const publish = this.form.controls.publishNow.value;
    this.save(
      this.jobs.createJobListing(this.createPayload(), photo).pipe(
        switchMap((res) =>
          publish
            ? this.jobs.updateJobListing(res.data.id, { status: JobStatus.OPEN }).pipe(
                map((opened) => ({
                  message: `“${opened.data.title}” was posted and is open for applications.`,
                  listing: opened.data,
                })),
              )
            : of({
                message: `“${res.data.title}” was saved as a draft. Publish it when you're ready.`,
                listing: res.data,
              }),
        ),
      ),
    );
  }

  private save(request: Observable<JobListingSaved>): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => this.done.emit(saved),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  /** Blank fields are left out so the API defaults apply. */
  private createPayload(): CreateJobListingRequestDto {
    const {
      salaryVisible,
      publishNow: _publish,
      status: _status,
      ...text
    } = this.form.getRawValue();
    const payload: Record<string, unknown> = { salaryVisible };
    for (const [key, raw] of Object.entries(text)) {
      const value = raw.trim();
      if (value !== '') payload[key] = convert(key, value);
    }
    return payload as unknown as CreateJobListingRequestDto;
  }

  /** Only what differs from the saved listing. */
  private changedFields(): UpdateJobListingRequestDto {
    const original = this.original();
    if (!original) return {};
    const { salaryVisible, publishNow: _publish, ...after } = this.form.getRawValue();
    const before = this.toFormValue(original);
    const changes: Record<string, unknown> = {};
    if (salaryVisible !== before.salaryVisible) changes['salaryVisible'] = salaryVisible;
    for (const [key, raw] of Object.entries(after)) {
      const value = LIST_FIELDS.has(key) ? splitLines(raw).join('\n') : raw.trim();
      const previous = String(before[key as keyof typeof before]).trim();
      if (value === previous) continue;
      if (value === '' && KEEP_WHEN_BLANK.has(key)) continue;
      changes[key] = value === '' && !LIST_FIELDS.has(key) ? '' : convert(key, value);
    }
    return changes as UpdateJobListingRequestDto;
  }

  /** Today or later; an unchanged past deadline may stay when editing. */
  private deadlineRule(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value || value >= todayIso()) return null;
    return value === this.original()?.applicationDeadline ? null : { pastDeadline: true };
  }

  private toFormValue(job: JobListingResponseDto) {
    const number = (value?: number) => (value === undefined || value === null ? '' : String(value));
    const lines = (items?: string[]) => (items ?? []).join('\n');
    return {
      title: job.title ?? '',
      status: (job.status ?? '') as JobStatus | '',
      positionTitle: job.positionTitle ?? '',
      shortDescription: job.shortDescription ?? '',
      description: job.description ?? '',
      responsibilities: job.responsibilities ?? '',
      requirements: job.requirements ?? '',
      faculty: job.faculty ?? '',
      department: job.department ?? '',
      reportsTo: job.reportsTo ?? '',
      employmentType: (job.employmentType ?? '') as EmploymentType | '',
      workMode: (job.workMode ?? '') as WorkMode | '',
      experienceLevel: (job.experienceLevel ?? '') as ExperienceLevel | '',
      minimumYearsExperience: number(job.minimumYearsExperience),
      minimumEducation: job.minimumEducation ?? '',
      numberOfVacancies: number(job.numberOfVacancies),
      city: job.city ?? '',
      stateRegion: job.stateRegion ?? '',
      country: job.country ?? '',
      skills: lines(job.skills),
      certifications: lines(job.certifications),
      languages: lines(job.languages),
      benefits: lines(job.benefits),
      salaryMin: number(job.salaryMin),
      salaryMax: number(job.salaryMax),
      currency: job.currency ?? '',
      salaryPeriod: (job.salaryPeriod ?? '') as SalaryPeriod | '',
      applicationDeadline: job.applicationDeadline ?? '',
      expectedStartDate: job.expectedStartDate ?? '',
      contactEmail: job.contactEmail ?? '',
      applicationInstructions: job.applicationInstructions ?? '',
      jobPhotoUrl: job.jobPhotoUrl ?? '',
      salaryVisible: job.salaryVisible ?? true,
      publishNow: false,
    };
  }

  private setPhoto(file: File | null): void {
    const old = this.photoPreview();
    if (old) URL.revokeObjectURL(old);
    this.photo.set(file);
    this.photoPreview.set(file ? URL.createObjectURL(file) : null);
  }
}

function convert(key: string, value: string): unknown {
  if (NUMBER_FIELDS.has(key)) return Number(value);
  if (LIST_FIELDS.has(key)) return splitLines(value);
  if (key === 'currency') return value.toUpperCase();
  if (key === 'contactEmail') return value.toLowerCase();
  return value;
}
