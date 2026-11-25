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
import { ApiResponse, isApiErrorResponse } from '../../../core/interface';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import {
  CreateLibraryBookRequestDto,
  LIBRARY_LIMITS,
  LibraryBookResponseDto,
  UpdateLibraryBookRequestDto,
} from '../library.model';
import { LibraryService } from '../library.service';

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

/** ≥ 0, at most 8 digits before the point and 2 after. */
function lateFee(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  return /^\d{1,8}(\.\d{1,2})?$/.test(value) ? null : { moneyFormat: { integer: 8 } };
}

/** ISBN-10 or ISBN-13 once dashes and spaces are removed (the backend strips them too). */
function isbn(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).replace(/[\s-]/g, '').toUpperCase();
  if (!value) return null;
  return /^(\d{9}[\dX]|\d{13})$/.test(value) ? null : { pattern: true };
}

type FieldName =
  | 'title'
  | 'subtitle'
  | 'author'
  | 'isbn'
  | 'publisher'
  | 'publicationYear'
  | 'edition'
  | 'language'
  | 'category'
  | 'description'
  | 'pageCount'
  | 'shelfLocation'
  | 'totalCopies'
  | 'loanPeriodDays'
  | 'maxRenewals'
  | 'dailyLateFee'
  | 'currency';

interface FieldConfig {
  name: FieldName;
  label: string;
  max?: number;
  placeholder?: string;
  hint?: string;
  patternMessage?: string;
  numeric?: boolean;
  textarea?: boolean;
  required?: boolean;
  wide?: boolean;
}

const SECTIONS: readonly { title: string; fields: readonly FieldConfig[] }[] = [
  {
    title: 'Book',
    fields: [
      { name: 'title', label: 'Title', max: 255, required: true, wide: true },
      { name: 'subtitle', label: 'Subtitle', max: 255, wide: true },
      { name: 'author', label: 'Author', max: 255, required: true },
      {
        name: 'isbn',
        label: 'ISBN',
        max: 20,
        placeholder: '978-0-13-468599-1',
        hint: 'ISBN-10 or ISBN-13; dashes and spaces are fine.',
        patternMessage: 'Enter a 10- or 13-digit ISBN (ISBN-10 may end with X).',
      },
      { name: 'publisher', label: 'Publisher', max: 150 },
      {
        name: 'publicationYear',
        label: 'Year published',
        max: 4,
        numeric: true,
        placeholder: '2024',
      },
      { name: 'edition', label: 'Edition', max: 50, placeholder: '3rd' },
      { name: 'language', label: 'Language', max: 50, placeholder: 'English' },
      { name: 'category', label: 'Category', max: 100, placeholder: 'Mathematics' },
      { name: 'pageCount', label: 'Pages', max: 5, numeric: true },
      { name: 'description', label: 'Description', max: 10_000, textarea: true, wide: true },
    ],
  },
  {
    title: 'Copies & loans',
    fields: [
      { name: 'shelfLocation', label: 'Shelf', max: 50, placeholder: 'B2-14' },
      { name: 'totalCopies', label: 'Copies', max: 5, numeric: true, hint: '1 when left blank.' },
      {
        name: 'loanPeriodDays',
        label: 'Loan period (days)',
        max: 3,
        numeric: true,
        hint: '14 when left blank.',
      },
      {
        name: 'maxRenewals',
        label: 'Renewals allowed',
        max: 2,
        numeric: true,
        hint: '2 when left blank.',
      },
      {
        name: 'dailyLateFee',
        label: 'Late fee per day',
        max: 11,
        numeric: true,
        placeholder: '0.50',
      },
      {
        name: 'currency',
        label: 'Currency',
        max: 3,
        placeholder: 'USD',
        patternMessage: 'Use a 3-letter currency code, e.g. XAF.',
      },
    ],
  },
];

const NUMBER_FIELDS = new Set([
  'publicationYear',
  'pageCount',
  'totalCopies',
  'loanPeriodDays',
  'maxRenewals',
  'dailyLateFee',
]);
/** Optional text the API clears when sent as "". */
const CLEARABLE = new Set([
  'subtitle',
  'publisher',
  'edition',
  'language',
  'category',
  'description',
  'shelfLocation',
]);

export interface BookSaved {
  message: string;
  book: LibraryBookResponseDto;
}

/**
 * Dialog to add a book (`POST /library/books`) or update one (`PATCH /library/books/{id}`), with
 * an optional cover image. An update only sends the fields that changed.
 */
@Component({
  selector: 'app-book-form',
  imports: [FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-form.html',
})
export class BookForm implements OnInit {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly bookId = input<string | null>(null);
  readonly done = output<BookSaved>();
  readonly cancelled = output<void>();

  protected readonly sections = SECTIONS;
  protected readonly inputClasses = inputClasses;
  protected readonly isEdit = computed(() => !!this.bookId());
  protected readonly original = signal<LibraryBookResponseDto | null>(null);

  protected readonly form = this.fb.group({
    title: ['', trimmed([Validators.required, Validators.maxLength(255)])],
    subtitle: ['', Validators.maxLength(255)],
    author: ['', trimmed([Validators.required, Validators.maxLength(255)])],
    isbn: ['', isbn],
    publisher: ['', Validators.maxLength(150)],
    publicationYear: ['', wholeNumber(1400, 2100)],
    edition: ['', Validators.maxLength(50)],
    language: ['', Validators.maxLength(50)],
    category: ['', Validators.maxLength(100)],
    description: ['', Validators.maxLength(10_000)],
    pageCount: ['', wholeNumber(1, 20_000)],
    shelfLocation: ['', Validators.maxLength(50)],
    totalCopies: ['', wholeNumber(1, 10_000)],
    loanPeriodDays: ['', wholeNumber(1, 365)],
    maxRenewals: ['', wholeNumber(0, 10)],
    dailyLateFee: ['', lateFee],
    currency: ['', trimmed([Validators.pattern(/^[A-Za-z]{3}$/)])],
    borrowable: [true],
    active: [true],
  });

  protected readonly cover = signal<File | null>(null);
  protected readonly coverPreview = signal<string | null>(null);
  protected readonly coverError = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      const url = this.coverPreview();
      if (url) URL.revokeObjectURL(url);
    });
  }

  ngOnInit(): void {
    if (this.bookId()) {
      // On update the API allows 0 copies (e.g. all copies lost).
      this.form.controls.totalCopies.setValidators(wholeNumber(0, 10_000));
      this.load();
    }
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(): void {
    const id = this.bookId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.library
      .getBook(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (book) => {
          this.original.set(book);
          this.form.reset(this.toFormValue(book));
        },
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this book. Try again.',
          ),
      });
  }

  protected pickCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.coverError.set(null);
    if (file && !(LIBRARY_LIMITS.coverTypes as readonly string[]).includes(file.type)) {
      this.coverError.set('Choose a JPEG, PNG or WebP image.');
      input.value = '';
      return;
    }
    if (file && file.size > LIBRARY_LIMITS.maxCoverBytes) {
      this.coverError.set('The cover must be 5 MB or smaller.');
      input.value = '';
      return;
    }
    const old = this.coverPreview();
    if (old) URL.revokeObjectURL(old);
    this.cover.set(file);
    this.coverPreview.set(file ? URL.createObjectURL(file) : null);
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.bookId();
    if (id) {
      const changes = this.changedFields();
      if (!Object.keys(changes).length && !this.cover()) {
        this.serverError.set('Nothing to save: change a field or choose a cover first.');
        return;
      }
      this.save(this.library.updateBook(id, changes, this.cover()), 'Changes to “{t}” were saved.');
    } else {
      this.save(
        this.library.addBook(this.createPayload(), this.cover()),
        '“{t}” was added to the catalog.',
      );
    }
  }

  private save(request: Observable<ApiResponse<LibraryBookResponseDto>>, message: string): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) =>
          this.done.emit({ message: message.replace('{t}', res.data.title), book: res.data }),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private createPayload(): CreateLibraryBookRequestDto {
    const { borrowable, active: _active, ...text } = this.form.getRawValue();
    const payload: Record<string, unknown> = { borrowable };
    for (const [key, raw] of Object.entries(text)) {
      const value = raw.trim();
      if (value !== '') payload[key] = convert(key, value);
    }
    return payload as unknown as CreateLibraryBookRequestDto;
  }

  private changedFields(): UpdateLibraryBookRequestDto {
    const original = this.original();
    if (!original) return {};
    const { borrowable, active, ...after } = this.form.getRawValue();
    const before = this.toFormValue(original);
    const changes: Record<string, unknown> = {};
    if (borrowable !== before.borrowable) changes['borrowable'] = borrowable;
    if (active !== before.active) changes['active'] = active;
    for (const [key, raw] of Object.entries(after)) {
      const value = raw.trim();
      if (value === String(before[key as keyof typeof before]).trim()) continue;
      if (value === '') {
        if (CLEARABLE.has(key)) changes[key] = '';
        continue;
      }
      changes[key] = convert(key, value);
    }
    return changes as UpdateLibraryBookRequestDto;
  }

  private toFormValue(b: LibraryBookResponseDto) {
    const text = (value?: string | number | null) =>
      value === undefined || value === null ? '' : String(value);
    return {
      title: text(b.title),
      subtitle: text(b.subtitle),
      author: text(b.author),
      isbn: text(b.isbn),
      publisher: text(b.publisher),
      publicationYear: text(b.publicationYear),
      edition: text(b.edition),
      language: text(b.language),
      category: text(b.category),
      description: text(b.description),
      pageCount: text(b.pageCount),
      shelfLocation: text(b.shelfLocation),
      totalCopies: text(b.totalCopies),
      loanPeriodDays: text(b.loanPeriodDays),
      maxRenewals: text(b.maxRenewals),
      dailyLateFee: text(b.dailyLateFee),
      currency: text(b.currency),
      borrowable: b.borrowable,
      active: b.active,
    };
  }
}

function convert(key: string, value: string): unknown {
  if (NUMBER_FIELDS.has(key)) return Number(value);
  if (key === 'currency') return value.toUpperCase();
  if (key === 'isbn') return value.replace(/[\s-]/g, '').toUpperCase();
  return value;
}
