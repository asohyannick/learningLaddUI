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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Observable, finalize, map } from 'rxjs';
import { ApiResponse, isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import {
  CreatePartnersRequestDto,
  PARTNER_PATTERNS,
  PARTNER_STATUSES,
  PARTNER_TYPES,
  PartnerStatus,
  PartnerType,
  PartnersResponseDto,
  SPONSORSHIP_TIERS,
  SponsorshipTier,
  UpdatePartnerRequestDto,
  slugify,
} from '../partnership.model';
import { PartnershipService } from '../partnership.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type ImageField = 'logo' | 'banner';

function displayOrderValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return { wholeNumber: true };
  return Number(value) > 10_000 ? { max: { max: 10_000 } } : null;
}

function amountValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (value.startsWith('-')) return { min: { min: 0 } };
  return /^\d{1,12}(\.\d{1,2})?$/.test(value) ? null : { moneyFormat: { integer: 12 } };
}

function tierForSponsor(control: AbstractControl): ValidationErrors | null {
  const type = control.parent?.get('partnerType')?.value as string | undefined;
  return type === PartnerType.SPONSOR && !control.value ? { tierRequired: true } : null;
}

function endAfterStart(control: AbstractControl): ValidationErrors | null {
  const start = control.parent?.get('agreementStartDate')?.value as string | undefined;
  const end = control.value as string;
  return start && end && end < start ? { endBeforeStart: true } : null;
}

function optional(pattern: RegExp, max?: number): ValidatorFn {
  return trimmed([Validators.pattern(pattern), ...(max ? [Validators.maxLength(max)] : [])]);
}

type FieldName =
  | 'name'
  | 'slug'
  | 'partnerType'
  | 'sponsorshipTier'
  | 'status'
  | 'industry'
  | 'shortDescription'
  | 'description'
  | 'benefits'
  | 'displayOrder'
  | 'contactPersonName'
  | 'contactPersonTitle'
  | 'contactEmail'
  | 'contactPhone'
  | 'addressLine'
  | 'city'
  | 'stateRegion'
  | 'country'
  | 'agreementStartDate'
  | 'agreementEndDate'
  | 'agreementDocumentId'
  | 'sponsorshipAmount'
  | 'sponsorshipCurrency'
  | 'websiteUrl'
  | 'linkedinUrl'
  | 'facebookUrl'
  | 'twitterUrl'
  | 'instagramUrl'
  | 'internalNotes';

interface FieldConfig {
  name: FieldName;
  label: string;
  kind: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select';
  max?: number;
  rows?: number;
  placeholder?: string;
  hint?: string;
  patternMessage?: string;
  inputMode?: 'numeric' | 'decimal' | 'url';
  options?: readonly string[];
  emptyLabel?: string | null;
  emptyLabelEdit?: string | null;
  required?: boolean;
  wide?: boolean;
}

const URL_MESSAGE = 'Enter a web address, e.g. https://example.org';

const SECTIONS: readonly { title: string; fields: readonly FieldConfig[] }[] = [
  {
    title: 'Organisation',
    fields: [
      {
        name: 'name',
        label: 'Name',
        kind: 'text',
        max: 150,
        placeholder: 'e.g. Orange Foundation',
        required: true,
      },
      {
        name: 'slug',
        label: 'Web address (slug)',
        kind: 'text',
        max: 150,
        hint: 'Used in the partner page link. Made from the name when left blank.',
        patternMessage: 'Use lowercase letters and digits separated by single hyphens.',
      },
      {
        name: 'partnerType',
        label: 'Partner type',
        kind: 'select',
        options: PARTNER_TYPES,
        emptyLabel: 'Choose a type',
        emptyLabelEdit: null,
        required: true,
      },
      {
        name: 'sponsorshipTier',
        label: 'Sponsorship tier',
        kind: 'select',
        options: SPONSORSHIP_TIERS,
        emptyLabel: 'No tier',
        emptyLabelEdit: 'No tier',
        hint: 'Required for sponsors.',
      },
      {
        name: 'status',
        label: 'Status',
        kind: 'select',
        options: PARTNER_STATUSES,
        emptyLabel: 'Pending (default)',
        emptyLabelEdit: null,
        hint: 'Only active partners appear on the website.',
      },
      { name: 'industry', label: 'Industry', kind: 'text', max: 100, placeholder: 'e.g. Telecom' },
      {
        name: 'shortDescription',
        label: 'Short description',
        kind: 'textarea',
        rows: 2,
        max: 300,
        placeholder: 'One or two lines for cards and the carousel',
        wide: true,
      },
      {
        name: 'description',
        label: 'Description',
        kind: 'textarea',
        rows: 4,
        max: 10_000,
        placeholder: 'Who they are and how they work with Learning Ladder',
        wide: true,
      },
      {
        name: 'benefits',
        label: 'Benefits',
        kind: 'textarea',
        rows: 3,
        max: 5000,
        placeholder: 'What the partnership brings to students and staff',
        wide: true,
      },
    ],
  },
  {
    title: 'Agreement & sponsorship',
    fields: [
      { name: 'agreementStartDate', label: 'Agreement start', kind: 'date' },
      { name: 'agreementEndDate', label: 'Agreement end', kind: 'date' },
      {
        name: 'sponsorshipAmount',
        label: 'Sponsorship amount',
        kind: 'text',
        max: 15,
        placeholder: 'e.g. 25000.00',
        inputMode: 'decimal',
      },
      {
        name: 'sponsorshipCurrency',
        label: 'Currency',
        kind: 'text',
        max: 3,
        placeholder: 'USD',
        hint: '3-letter code. USD when left blank.',
        patternMessage: 'Use a 3-letter currency code, e.g. XAF.',
      },
      {
        name: 'agreementDocumentId',
        label: 'Agreement document ID',
        kind: 'text',
        max: 36,
        placeholder: 'ID of the uploaded signed agreement',
        patternMessage: 'Paste the file ID (a UUID) returned when the agreement was uploaded.',
        wide: true,
      },
    ],
  },
  {
    title: 'Contact person',
    fields: [
      { name: 'contactPersonName', label: 'Name', kind: 'text', max: 150 },
      {
        name: 'contactPersonTitle',
        label: 'Job title',
        kind: 'text',
        max: 100,
        placeholder: 'e.g. CSR Manager',
      },
      { name: 'contactEmail', label: 'Email', kind: 'email', max: 255 },
      {
        name: 'contactPhone',
        label: 'Phone',
        kind: 'tel',
        max: 30,
        placeholder: '+237 670 000 000',
        patternMessage: 'Use 7–30 digits, spaces, brackets or dashes, with an optional leading +.',
      },
    ],
  },
  {
    title: 'Address',
    fields: [
      { name: 'addressLine', label: 'Street address', kind: 'text', max: 255, wide: true },
      { name: 'city', label: 'City', kind: 'text', max: 100 },
      { name: 'stateRegion', label: 'State / region', kind: 'text', max: 100 },
      { name: 'country', label: 'Country', kind: 'text', max: 100 },
    ],
  },
  {
    title: 'Online',
    fields: [
      {
        name: 'websiteUrl',
        label: 'Website',
        kind: 'text',
        max: 500,
        placeholder: 'https://…',
        inputMode: 'url',
        patternMessage: URL_MESSAGE,
      },
      {
        name: 'linkedinUrl',
        label: 'LinkedIn',
        kind: 'text',
        max: 500,
        inputMode: 'url',
        patternMessage: URL_MESSAGE,
      },
      {
        name: 'facebookUrl',
        label: 'Facebook',
        kind: 'text',
        max: 500,
        inputMode: 'url',
        patternMessage: URL_MESSAGE,
      },
      {
        name: 'twitterUrl',
        label: 'X / Twitter',
        kind: 'text',
        max: 500,
        inputMode: 'url',
        patternMessage: URL_MESSAGE,
      },
      {
        name: 'instagramUrl',
        label: 'Instagram',
        kind: 'text',
        max: 500,
        inputMode: 'url',
        patternMessage: URL_MESSAGE,
      },
    ],
  },
  {
    title: 'Website display',
    fields: [
      {
        name: 'displayOrder',
        label: 'Display order',
        kind: 'text',
        max: 5,
        placeholder: '0',
        hint: 'Lower numbers are shown first (0–10,000).',
        inputMode: 'numeric',
      },
    ],
  },
  {
    title: 'Staff only',
    fields: [
      {
        name: 'internalNotes',
        label: 'Internal notes',
        kind: 'textarea',
        rows: 3,
        max: 2000,
        hint: 'Never shown on the website.',
        wide: true,
      },
    ],
  },
];

const NUMBER_FIELDS = new Set(['displayOrder', 'sponsorshipAmount']);

export interface PartnerSaved {
  message: string;
  partner: PartnersResponseDto;
}

@Component({
  selector: 'app-partner-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-form.html',
})
export class PartnerForm implements OnInit {
  private readonly partners = inject(PartnershipService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly partnerId = input<string | null>(null);
  readonly done = output<PartnerSaved>();
  readonly cancelled = output<void>();

  protected readonly sections = SECTIONS;
  protected readonly imageSlots: readonly ImageField[] = ['logo', 'banner'];
  protected readonly inputClasses = inputClasses;

  protected readonly isEdit = computed(() => !!this.partnerId());
  protected readonly original = signal<PartnersResponseDto | null>(null);

  protected readonly form = this.fb.group({
    name: ['', trimmed([Validators.required, Validators.maxLength(150)])],
    slug: ['', optional(PARTNER_PATTERNS.slug, 150)],
    partnerType: ['' as PartnerType | '', Validators.required],
    sponsorshipTier: ['' as SponsorshipTier | '', tierForSponsor],
    status: ['' as PartnerStatus | ''],
    industry: ['', Validators.maxLength(100)],
    shortDescription: ['', Validators.maxLength(300)],
    description: ['', Validators.maxLength(10_000)],
    benefits: ['', Validators.maxLength(5000)],
    displayOrder: ['', displayOrderValidator],
    contactPersonName: ['', Validators.maxLength(150)],
    contactPersonTitle: ['', Validators.maxLength(100)],
    contactEmail: ['', trimmed([Validators.email, Validators.maxLength(255)])],
    contactPhone: ['', optional(PARTNER_PATTERNS.phone)],
    addressLine: ['', Validators.maxLength(255)],
    city: ['', Validators.maxLength(100)],
    stateRegion: ['', Validators.maxLength(100)],
    country: ['', Validators.maxLength(100)],
    agreementStartDate: [''],
    agreementEndDate: ['', endAfterStart],
    agreementDocumentId: ['', optional(PARTNER_PATTERNS.uuid)],
    sponsorshipAmount: ['', amountValidator],
    sponsorshipCurrency: ['', optional(PARTNER_PATTERNS.currency)],
    websiteUrl: ['', optional(PARTNER_PATTERNS.url, 500)],
    linkedinUrl: ['', optional(PARTNER_PATTERNS.url, 500)],
    facebookUrl: ['', optional(PARTNER_PATTERNS.url, 500)],
    twitterUrl: ['', optional(PARTNER_PATTERNS.url, 500)],
    instagramUrl: ['', optional(PARTNER_PATTERNS.url, 500)],
    internalNotes: ['', Validators.maxLength(2000)],
    showOnWebsite: [true],
    featured: [false],
  });

  protected readonly suggestedSlug = toSignal(
    this.form.controls.name.valueChanges.pipe(map((name) => slugify(name))),
    { initialValue: '' },
  );

  protected readonly images = signal<Record<ImageField, File | null>>({ logo: null, banner: null });
  protected readonly previews = signal<Record<ImageField, string | null>>({
    logo: null,
    banner: null,
  });
  protected readonly imageErrors = signal<Record<ImageField, string | null>>({
    logo: null,
    banner: null,
  });

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const url of Object.values(this.previews())) if (url) URL.revokeObjectURL(url);
    });
    const recheck = (source: AbstractControl, target: AbstractControl) =>
      source.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => target.updateValueAndValidity());
    const c = this.form.controls;
    recheck(c.partnerType, c.sponsorshipTier);
    recheck(c.agreementStartDate, c.agreementEndDate);
  }

  ngOnInit(): void {
    if (this.partnerId()) this.load();
  }

  protected emptyLabel(field: FieldConfig): string | null {
    return (this.isEdit() ? field.emptyLabelEdit : field.emptyLabel) ?? null;
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(): void {
    const id = this.partnerId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.partners
      .getPartner(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.original.set(res.data);
          this.form.reset(this.toFormValue(res.data));
        },
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this partner. Try again.',
          ),
      });
  }

  protected pickImage(field: ImageField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setImageError(field, null);
    if (file && !IMAGE_TYPES.includes(file.type)) {
      this.setImageError(field, 'Choose a JPEG, PNG or WebP image.');
      input.value = '';
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      this.setImageError(field, 'The image must be 5 MB or smaller.');
      input.value = '';
      return;
    }
    this.setImage(field, file);
  }

  protected clearImage(field: ImageField, input: HTMLInputElement): void {
    input.value = '';
    this.setImage(field, null);
    this.setImageError(field, null);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { logo, banner } = this.images();
    const files = { logo: logo ?? undefined, banner: banner ?? undefined };
    const id = this.partnerId();
    if (id) {
      const changes = this.changedFields();
      if (!Object.keys(changes).length && !logo && !banner) {
        this.serverError.set('Nothing to save: change a field or choose an image first.');
        return;
      }
      this.save(this.partners.updatePartner(id, changes, files));
    } else {
      this.save(this.partners.createPartner(this.createPayload(), files));
    }
  }

  private save(request: Observable<ApiResponse<PartnersResponseDto>>): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit({ message: res.message, partner: res.data }),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private createPayload(): CreatePartnersRequestDto {
    const { showOnWebsite, featured, ...text } = this.form.getRawValue();
    const payload: Record<string, unknown> = { showOnWebsite, featured };
    for (const [key, raw] of Object.entries(text)) {
      const value = raw.trim();
      if (value !== '') payload[key] = convert(key, value);
    }
    return payload as unknown as CreatePartnersRequestDto;
  }

  private changedFields(): UpdatePartnerRequestDto {
    const original = this.original();
    if (!original) return {};
    const { showOnWebsite, featured, ...after } = this.form.getRawValue();
    const before = this.toFormValue(original);
    const changes: Record<string, unknown> = {};
    if (showOnWebsite !== before.showOnWebsite) changes['showOnWebsite'] = showOnWebsite;
    if (featured !== before.featured) changes['featured'] = featured;
    for (const [key, raw] of Object.entries(after)) {
      const value = raw.trim();
      const previous = String(before[key as keyof typeof before]).trim();
      if (value === previous) continue;
      if (value === '') {
        if (key === 'sponsorshipTier') changes['removeSponsorshipTier'] = true;
        if (key === 'agreementEndDate') changes['removeAgreementEndDate'] = true;
        continue;
      }
      changes[key] = convert(key, value);
    }
    return changes as UpdatePartnerRequestDto;
  }

  private toFormValue(p: PartnersResponseDto) {
    const number = (value?: number) => (value === undefined || value === null ? '' : String(value));
    return {
      name: p.name ?? '',
      slug: p.slug ?? '',
      partnerType: (p.partnerType ?? '') as PartnerType | '',
      sponsorshipTier: (p.sponsorshipTier ?? '') as SponsorshipTier | '',
      status: (p.status ?? '') as PartnerStatus | '',
      industry: p.industry ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      benefits: p.benefits ?? '',
      displayOrder: number(p.displayOrder),
      contactPersonName: p.contactPersonName ?? '',
      contactPersonTitle: p.contactPersonTitle ?? '',
      contactEmail: p.contactEmail ?? '',
      contactPhone: p.contactPhone ?? '',
      addressLine: p.addressLine ?? '',
      city: p.city ?? '',
      stateRegion: p.stateRegion ?? '',
      country: p.country ?? '',
      agreementStartDate: p.agreementStartDate ?? '',
      agreementEndDate: p.agreementEndDate ?? '',
      agreementDocumentId: p.agreementDocumentId ?? '',
      sponsorshipAmount: number(p.sponsorshipAmount),
      sponsorshipCurrency: p.sponsorshipCurrency ?? '',
      websiteUrl: p.websiteUrl ?? '',
      linkedinUrl: p.linkedinUrl ?? '',
      facebookUrl: p.facebookUrl ?? '',
      twitterUrl: p.twitterUrl ?? '',
      instagramUrl: p.instagramUrl ?? '',
      internalNotes: p.internalNotes ?? '',
      showOnWebsite: p.showOnWebsite ?? true,
      featured: p.featured ?? false,
    };
  }

  private setImage(field: ImageField, file: File | null): void {
    const old = this.previews()[field];
    if (old) URL.revokeObjectURL(old);
    this.images.update((images) => ({ ...images, [field]: file }));
    this.previews.update((p) => ({ ...p, [field]: file ? URL.createObjectURL(file) : null }));
  }

  private setImageError(field: ImageField, message: string | null): void {
    this.imageErrors.update((errors) => ({ ...errors, [field]: message }));
  }
}

function convert(key: string, value: string): unknown {
  if (NUMBER_FIELDS.has(key)) return Number(value);
  if (key === 'sponsorshipCurrency') return value.toUpperCase();
  if (key === 'contactEmail') return value.toLowerCase();
  return value;
}
