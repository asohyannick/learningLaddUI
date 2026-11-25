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
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import {
  COURSE_LEVELS,
  COURSE_STATUSES,
  CourseLevel,
  CourseStatus,
} from '../../../core/enum/global-enum-configuration';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import { CourseFiles, CourseResponse, CreateCourseRequest } from '../course.model';
import { CourseService } from '../course.service';

type SingleFile = 'thumbnail' | 'promoVideo' | 'syllabus';

function discountNotAbovePrice(control: AbstractControl): ValidationErrors | null {
  const discount = control.value as number | null;
  if (discount === null || discount === undefined) return null;
  const price = (control.parent?.get('price')?.value as number | null) ?? 0;
  return discount > price ? { discountAbovePrice: true } : null;
}

@Component({
  selector: 'app-course-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './course-form.html',
})
export class CourseForm implements OnInit {
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly courseId = input<string | null>(null);
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly levels = COURSE_LEVELS;
  protected readonly statuses = COURSE_STATUSES;
  protected readonly inputClasses = inputClasses;

  protected readonly isEdit = computed(() => !!this.courseId());

  protected readonly form = this.fb.group({
    name: ['', trimmed([Validators.required, Validators.minLength(3), Validators.maxLength(255)])],
    shortDescription: ['', Validators.maxLength(500)],
    description: ['', Validators.maxLength(20000)],
    learningOutcomes: ['', Validators.maxLength(10000)],
    requirements: ['', Validators.maxLength(10000)],
    category: ['', Validators.maxLength(100)],
    level: ['' as CourseLevel | ''],
    language: ['', Validators.maxLength(50)],
    durationMinutes: this.fb.control<number | null>(null, [
      Validators.min(1),
      Validators.max(525600),
    ]),
    price: this.fb.control<number | null>(null, Validators.min(0)),
    discount: this.fb.control<number | null>(null, [Validators.min(0), discountNotAbovePrice]),
    currency: ['USD', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    status: ['' as CourseStatus | ''],
    published: [false],
  });

  protected readonly files = signal<Record<SingleFile, File | null>>({
    thumbnail: null,
    promoVideo: null,
    syllabus: null,
  });
  protected readonly materials = signal<File[]>([]);

  protected readonly original = signal<CourseResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  private readonly idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor() {
    this.form.controls.price.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.discount.updateValueAndValidity());
  }

  ngOnInit(): void {
    const id = this.courseId();
    if (id) this.load(id);
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(id = this.courseId()): void {
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.courses
      .getCourse(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (course) => {
          this.original.set(course);
          this.form.reset(this.toFormValue(course));
        },
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this course. Try again.',
          ),
      });
  }

  protected pickFile(kind: SingleFile, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.files.update((files) => ({ ...files, [kind]: file }));
  }

  protected clearFile(kind: SingleFile, input: HTMLInputElement): void {
    input.value = '';
    this.files.update((files) => ({ ...files, [kind]: null }));
  }

  protected addMaterials(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    this.materials.update((files) => [...files, ...picked]);
    input.value = '';
  }

  protected removeMaterial(index: number): void {
    this.materials.update((files) => files.filter((_, i) => i !== index));
  }

  protected fileSize(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const files: CourseFiles = { ...this.files(), materials: this.materials() };
    const id = this.courseId();
    const original = this.original();
    if (id && original) {
      const changes = this.changedFields(original);
      if (!Object.keys(changes).length && !this.hasFiles(files)) {
        this.serverError.set('Nothing to save: change a field or add a file first.');
        return;
      }
      this.save(this.courses.updateCourse(id, changes, files));
    } else {
      this.save(this.courses.createCourse(this.createPayload(), files, this.idempotencyKey));
    }
  }

  private save(request: ReturnType<CourseService['createCourse']>): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit(res.message),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private createPayload(): CreateCourseRequest {
    const v = this.form.getRawValue();
    const text = (value: string) => value.trim() || undefined;
    return stripUndefined({
      name: v.name.trim(),
      shortDescription: text(v.shortDescription),
      description: text(v.description),
      learningOutcomes: text(v.learningOutcomes),
      requirements: text(v.requirements),
      category: text(v.category),
      level: v.level || undefined,
      language: text(v.language),
      durationMinutes: v.durationMinutes ?? undefined,
      price: v.price ?? undefined,
      discount: v.discount ?? undefined,
      currency: v.currency.trim().toUpperCase(),
      status: v.status || undefined,
      published: v.published,
    });
  }

  private changedFields(original: CourseResponse): Partial<CreateCourseRequest> {
    const before = this.toFormValue(original);
    const after = this.form.getRawValue();
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(after) as (keyof typeof after)[]) {
      let value: unknown = after[key];
      if (typeof value === 'string') value = value.trim();
      if (key === 'currency') value = String(value).toUpperCase();
      const previous = typeof before[key] === 'string' ? String(before[key]).trim() : before[key];
      if (value === previous) continue;
      if (value === null || (value === '' && (key === 'level' || key === 'status'))) continue;
      changes[key] = value;
    }
    return changes as Partial<CreateCourseRequest>;
  }

  private hasFiles(files: CourseFiles): boolean {
    return !!(files.thumbnail || files.promoVideo || files.syllabus || files.materials?.length);
  }

  private toFormValue(course: CourseResponse) {
    return {
      name: course.name ?? '',
      shortDescription: course.shortDescription ?? '',
      description: course.description ?? '',
      learningOutcomes: course.learningOutcomes ?? '',
      requirements: course.requirements ?? '',
      category: course.category ?? '',
      level: (course.level ?? '') as CourseLevel | '',
      language: course.language ?? '',
      durationMinutes: course.durationMinutes ?? null,
      price: course.price ?? null,
      discount: course.discount ?? null,
      currency: course.currency ?? 'USD',
      status: (course.status ?? '') as CourseStatus | '',
      published: !!course.published,
    };
  }
}

function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
