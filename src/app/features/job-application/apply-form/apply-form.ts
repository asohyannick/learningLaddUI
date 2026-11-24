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
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/service/auth/auth.service';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import { JobListingResponseDto, SalaryPeriod } from '../../job-listing/job-listing.model';
import { todayIso } from '../../job-listing/job-listing.service';
import {
  APPLICATION_PHONE_PATTERN,
  CV_MAX_BYTES,
  CV_TYPES,
  CreateJobApplicationRequestDto,
  JobApplicationResponseDto,
  MAX_SUPPORTING_DOCS,
  PROFILE_PIC_MAX_BYTES,
  PROFILE_PIC_TYPES,
  SUPPORTING_DOC_MAX_BYTES,
  SUPPORTING_DOC_TYPES,
} from '../job-application.model';
import { JobApplicationService } from '../job-application.service';

const URL_PATTERN = /^https?:\/\/\S+$/;

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

function money(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  return /^\d{1,10}(\.\d{1,2})?$/.test(value) ? null : { moneyFormat: { integer: 10 } };
}

const NUMBER_FIELDS = new Set(['yearsOfExperience', 'noticePeriodDays', 'expectedSalary']);

function convert(key: string, value: string): unknown {
  if (NUMBER_FIELDS.has(key)) return Number(value);
  return key === 'email' ? value.toLowerCase() : value;
}

type ApplyField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'city'
  | 'country'
  | 'currentJobTitle'
  | 'currentEmployer'
  | 'yearsOfExperience'
  | 'highestEducation'
  | 'linkedinUrl'
  | 'portfolioUrl'
  | 'expectedSalary'
  | 'availableFrom'
  | 'noticePeriodDays'
  | 'coverLetter';

type FileSlot = 'cv' | 'profilePic' | 'supportingDocuments';

/**
 * Dialog to apply for a job (`POST /job-application`, multipart). Name and email come from the
 * account; the CV is required. Each submission sends its own Idempotency-Key, so a retry after
 * a network error never creates a second application.
 */
@Component({
  selector: 'app-apply-form',
  imports: [FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apply-form.html',
})
export class ApplyForm implements OnInit {
  private readonly applications = inject(JobApplicationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly user = inject(AuthService).user;

  readonly job = input.required<JobListingResponseDto>();
  /** The applicant's own application to edit; leave empty to apply. */
  readonly existing = input<JobApplicationResponseDto | null>(null);
  readonly done = output<JobApplicationResponseDto>();
  readonly cancelled = output<void>();

  protected readonly isEdit = computed(() => !!this.existing());
  /** IDs and links of the saved supporting documents the applicant keeps. */
  protected readonly keptDocs = signal<{ id: string; url?: string }[]>([]);

  protected readonly inputClasses = inputClasses;
  protected readonly today = todayIso();
  protected readonly maxDocs = MAX_SUPPORTING_DOCS;

  protected readonly form = this.fb.group({
    firstName: [
      this.user()?.firstName ?? '',
      trimmed([Validators.required, Validators.maxLength(100)]),
    ],
    lastName: [
      this.user()?.lastName ?? '',
      trimmed([Validators.required, Validators.maxLength(100)]),
    ],
    email: [
      this.user()?.email ?? '',
      trimmed([Validators.required, Validators.email, Validators.maxLength(255)]),
    ],
    phoneNumber: ['', trimmed([Validators.pattern(APPLICATION_PHONE_PATTERN)])],
    city: ['', Validators.maxLength(100)],
    country: ['', Validators.maxLength(100)],
    currentJobTitle: ['', Validators.maxLength(150)],
    currentEmployer: ['', Validators.maxLength(150)],
    yearsOfExperience: ['', wholeNumber(0, 60)],
    highestEducation: ['', Validators.maxLength(100)],
    linkedinUrl: ['', trimmed([Validators.pattern(URL_PATTERN), Validators.maxLength(500)])],
    portfolioUrl: ['', trimmed([Validators.pattern(URL_PATTERN), Validators.maxLength(500)])],
    expectedSalary: ['', money],
    availableFrom: ['', (c: AbstractControl) => this.availableRule(c)],
    noticePeriodDays: ['', wholeNumber(0, 365)],
    coverLetter: ['', Validators.maxLength(10_000)],
    consentGiven: [false, Validators.requiredTrue],
  });

  protected readonly fields: readonly {
    name: ApplyField;
    label: string;
    type?: string;
    max?: number;
    required?: boolean;
    placeholder?: string;
    wide?: boolean;
    textarea?: boolean;
    inputMode?: string;
    autocomplete?: string;
    patternMessage?: string;
  }[] = [
    {
      name: 'firstName',
      label: 'First name',
      max: 100,
      required: true,
      autocomplete: 'given-name',
    },
    { name: 'lastName', label: 'Last name', max: 100, required: true, autocomplete: 'family-name' },
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      max: 255,
      required: true,
      autocomplete: 'email',
    },
    {
      name: 'phoneNumber',
      label: 'Phone',
      type: 'tel',
      max: 30,
      placeholder: '+237 670 000 000',
      autocomplete: 'tel',
      patternMessage: 'Use 7–30 digits, spaces, brackets or dashes, with an optional leading +.',
    },
    { name: 'city', label: 'City', max: 100, autocomplete: 'address-level2' },
    { name: 'country', label: 'Country', max: 100, autocomplete: 'country-name' },
    { name: 'currentJobTitle', label: 'Current job title', max: 150 },
    { name: 'currentEmployer', label: 'Current employer', max: 150 },
    { name: 'yearsOfExperience', label: 'Years of experience', max: 2, inputMode: 'numeric' },
    {
      name: 'highestEducation',
      label: 'Highest education',
      max: 100,
      placeholder: "e.g. Master's degree",
    },
    {
      name: 'linkedinUrl',
      label: 'LinkedIn',
      max: 500,
      inputMode: 'url',
      placeholder: 'https://linkedin.com/in/…',
      patternMessage: 'Enter a web address starting with http:// or https://',
    },
    {
      name: 'portfolioUrl',
      label: 'Portfolio or website',
      max: 500,
      inputMode: 'url',
      placeholder: 'https://…',
      patternMessage: 'Enter a web address starting with http:// or https://',
    },
    { name: 'expectedSalary', label: 'Expected salary', max: 13, inputMode: 'decimal' },
    { name: 'availableFrom', label: 'Available from', type: 'date' },
    { name: 'noticePeriodDays', label: 'Notice period (days)', max: 3, inputMode: 'numeric' },
    {
      name: 'coverLetter',
      label: 'Cover letter',
      max: 10_000,
      textarea: true,
      wide: true,
      placeholder: 'Why this role, and what you would bring to it',
    },
  ];

  protected readonly cv = signal<File | null>(null);
  protected readonly profilePic = signal<File | null>(null);
  protected readonly docs = signal<File[]>([]);
  protected readonly fileErrors = signal<Record<FileSlot, string | null>>({
    cv: null,
    profilePic: null,
    supportingDocuments: null,
  });

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  /** One key per filled-in form: retries reuse it, so the API never stores the application twice. */
  private readonly idempotencyKey = crypto.randomUUID();

  ngOnInit(): void {
    const a = this.existing();
    if (!a) return;
    this.form.reset(this.toFormValue(a));
    this.keptDocs.set(
      a.supportingDocuments.map((id, i) => ({ id, url: a.supportingDocumentUrls[i] })),
    );
  }

  protected removeKeptDoc(id: string): void {
    this.keptDocs.update((docs) => docs.filter((doc) => doc.id !== id));
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected pickCv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    const problem = checkFile(file, CV_TYPES, CV_MAX_BYTES, 'a PDF or Word file', '10 MB');
    this.setFileError('cv', problem);
    if (problem) input.value = '';
    else this.cv.set(file);
  }

  protected pickProfilePic(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    const problem = checkFile(
      file,
      PROFILE_PIC_TYPES,
      PROFILE_PIC_MAX_BYTES,
      'a JPEG, PNG or WebP image',
      '5 MB',
    );
    this.setFileError('profilePic', problem);
    if (problem) input.value = '';
    else this.profilePic.set(file);
  }

  protected pickDocs(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    for (const file of picked) {
      const problem = checkFile(
        file,
        SUPPORTING_DOC_TYPES,
        SUPPORTING_DOC_MAX_BYTES,
        'a PDF, Word file or image',
        '10 MB',
      );
      if (problem) {
        this.setFileError('supportingDocuments', `${file.name}: ${problem}`);
        return;
      }
    }
    const all = [...this.docs(), ...picked];
    if (all.length + this.keptDocs().length > MAX_SUPPORTING_DOCS) {
      this.setFileError('supportingDocuments', `Attach at most ${MAX_SUPPORTING_DOCS} documents.`);
      return;
    }
    this.setFileError('supportingDocuments', null);
    this.docs.set(all);
  }

  protected removeDoc(index: number): void {
    this.docs.update((docs) => docs.filter((_, i) => i !== index));
  }

  protected removeFile(slot: 'cv' | 'profilePic', input: HTMLInputElement): void {
    input.value = '';
    (slot === 'cv' ? this.cv : this.profilePic).set(null);
  }

  protected submit(): void {
    this.serverError.set(null);
    const existing = this.existing();
    if (existing) {
      this.saveChanges(existing);
      return;
    }
    const cv = this.cv();
    if (!cv) this.setFileError('cv', 'Attach your CV (PDF, DOC or DOCX).');
    if (this.form.invalid || !cv) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.applications
      .submitApplication(
        this.payload(),
        { cv, profilePic: this.profilePic(), supportingDocuments: this.docs() },
        this.idempotencyKey,
      )
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit(res.data),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  /**
   * `PATCH /job-application/{id}` with only what changed. The API keeps a field that is left
   * out, so clearing a field keeps its saved value.
   */
  private saveChanges(existing: JobApplicationResponseDto): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const before = this.toFormValue(existing);
    const { consentGiven: _consent, ...after } = this.form.getRawValue();
    const changes: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(after)) {
      const value = raw.trim();
      if (value === '' || value === String(before[key as keyof typeof before]).trim()) continue;
      changes[key] = convert(key, value);
    }
    if (changes['expectedSalary'] !== undefined) {
      changes['expectedSalaryCurrency'] =
        existing.expectedSalaryCurrency ?? this.job().currency ?? 'USD';
      changes['expectedSalaryPeriod'] =
        existing.expectedSalaryPeriod ?? this.job().salaryPeriod ?? SalaryPeriod.MONTHLY;
    }
    const kept = this.keptDocs().map((doc) => doc.id);
    if (kept.length !== existing.supportingDocuments.length) changes['supportingDocuments'] = kept;

    const files = {
      cv: this.cv(),
      profilePic: this.profilePic(),
      supportingDocuments: this.docs(),
    };
    if (
      !Object.keys(changes).length &&
      !files.cv &&
      !files.profilePic &&
      !files.supportingDocuments.length
    ) {
      this.serverError.set('Nothing to save: change a field or add a file first.');
      return;
    }
    this.submitting.set(true);
    this.applications
      .updateApplication(existing.id, changes, {
        cv: files.cv ?? undefined,
        profilePic: files.profilePic,
        supportingDocuments: files.supportingDocuments,
      })
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit(res.data),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private toFormValue(a: JobApplicationResponseDto) {
    const text = (value?: string | number | null) =>
      value === undefined || value === null ? '' : String(value);
    return {
      firstName: text(a.firstName),
      lastName: text(a.lastName),
      email: text(a.email),
      phoneNumber: text(a.phoneNumber),
      city: text(a.city),
      country: text(a.country),
      currentJobTitle: text(a.currentJobTitle),
      currentEmployer: text(a.currentEmployer),
      yearsOfExperience: text(a.yearsOfExperience),
      highestEducation: text(a.highestEducation),
      linkedinUrl: text(a.linkedinUrl),
      portfolioUrl: text(a.portfolioUrl),
      expectedSalary: text(a.expectedSalary),
      availableFrom: text(a.availableFrom),
      noticePeriodDays: text(a.noticePeriodDays),
      coverLetter: text(a.coverLetter),
      consentGiven: true,
    };
  }

  private payload(): CreateJobApplicationRequestDto {
    const { consentGiven, ...text } = this.form.getRawValue();
    const payload: Record<string, unknown> = { jobListingId: this.job().id, consentGiven };
    for (const [key, raw] of Object.entries(text)) {
      const value = raw.trim();
      if (value === '') continue;
      payload[key] = convert(key, value);
    }
    if (payload['expectedSalary'] !== undefined) {
      payload['expectedSalaryCurrency'] = this.job().currency ?? 'USD';
      payload['expectedSalaryPeriod'] = this.job().salaryPeriod ?? SalaryPeriod.MONTHLY;
    }
    return payload as unknown as CreateJobApplicationRequestDto;
  }

  /** Today or later; a saved date that has since passed may stay when editing. */
  private availableRule(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value || value >= todayIso()) return null;
    return value === this.existing()?.availableFrom ? null : { notPast: true };
  }

  private setFileError(slot: FileSlot, message: string | null): void {
    this.fileErrors.update((errors) => ({ ...errors, [slot]: message }));
  }
}

function checkFile(file: File, types: string[], maxBytes: number, kind: string, limit: string) {
  if (!types.includes(file.type)) return `Choose ${kind}.`;
  if (file.size > maxBytes) return `The file must be ${limit} or smaller.`;
  return null;
}
