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
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Observable, finalize, map, startWith } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import { CourseService } from '../../course/course.service';
import {
  CreateTimeTableRequestDto,
  MEETING_URL_PATTERN,
  SESSION_MODES,
  SessionMode,
  TIMETABLE_STATUSES,
  TimeTableResponseDto,
  TimeTableStatus,
  UpdateTimeTableRequestDto,
  dayOfWeekOf,
  shortTime,
} from '../time-table.model';
import { TimeTableService } from '../time-table.service';

const MAX_CAPACITY = 100_000;

/** The browser's time zone, e.g. "Africa/Douala"; UTC when unknown. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** IANA zones the browser knows, for suggestions. */
function knownTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

// ─── Validators (mirror the backend's rules between fields) ───────────

function parentValue<T>(control: AbstractControl, name: string): T | undefined {
  return control.parent?.get(name)?.value as T | undefined;
}

/** End time after start time. */
function endTimeAfterStart(control: AbstractControl): ValidationErrors | null {
  const start = parentValue<string>(control, 'startTime');
  const end = control.value as string;
  return start && end && end <= start ? { endTimeBeforeStart: true } : null;
}

/** Weekly entries need a last date, on or after the first. */
function endDateRule(control: AbstractControl): ValidationErrors | null {
  if (!parentValue<boolean>(control, 'recurring')) return null;
  const end = control.value as string;
  if (!end) return { required: true };
  const start = parentValue<string>(control, 'startDate');
  return start && end < start ? { endBeforeStart: true } : null;
}

/** In-person and hybrid sessions need a location. */
function locationRule(control: AbstractControl): ValidationErrors | null {
  const mode = parentValue<SessionMode | ''>(control, 'sessionMode');
  if (!mode || mode === SessionMode.ONLINE) return null;
  return (control.value as string).trim() ? null : { required: true };
}

/** Online and hybrid sessions need a meeting link. */
function meetingUrlRule(control: AbstractControl): ValidationErrors | null {
  const mode = parentValue<SessionMode | ''>(control, 'sessionMode');
  if (!mode || mode === SessionMode.IN_PERSON) return null;
  return (control.value as string).trim() ? null : { required: true };
}

/** A zone the browser can use; the backend checks it again with `ZoneId.of`. */
function timeZoneRule(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return null;
  } catch {
    return { timeZone: true };
  }
}

/** Whole number, 1–100,000. */
function capacityRule(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string).trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return { wholeNumber: true };
  const n = Number(value);
  if (n < 1) return { min: { min: 1 } };
  return n > MAX_CAPACITY ? { max: { max: MAX_CAPACITY } } : null;
}

export interface TimeTableSaved {
  message: string;
  entry: TimeTableResponseDto;
}

interface FormValue {
  courseId: string;
  title: string;
  description: string;
  notes: string;
  sessionMode: SessionMode | '';
  location: string;
  meetingUrl: string;
  startDate: string;
  recurring: boolean;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  capacity: string;
  status: TimeTableStatus;
}

/**
 * Dialog to add a timetable entry (`POST /time-table`) or update one (`PUT /time-table/{id}`).
 * The weekday of a weekly entry is taken from its first date, so the two always agree.
 * An update sends only the fields that changed; clearing a text field clears it.
 */
@Component({
  selector: 'app-time-table-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-table-form.html',
})
export class TimeTableForm implements OnInit {
  private readonly timeTables = inject(TimeTableService);
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** Entry to update; leave empty to add one. */
  readonly timeTableId = input<string | null>(null);
  readonly done = output<TimeTableSaved>();
  readonly cancelled = output<void>();

  protected readonly modes = SESSION_MODES;
  protected readonly statuses = TIMETABLE_STATUSES;
  protected readonly timeZones = knownTimeZones();
  protected readonly inputClasses = inputClasses;

  protected readonly isEdit = computed(() => !!this.timeTableId());
  protected readonly original = signal<TimeTableResponseDto | null>(null);

  /** Courses to pick from when adding (the first 100, by name). */
  protected readonly courseOptions = rxResource({
    params: () => (this.isEdit() ? undefined : true),
    stream: () =>
      this.courses
        .searchCourses({ page: 0, size: 100, sortBy: 'name', sortDirection: 'asc' })
        .pipe(map((page) => page.content.map((c) => ({ id: c.id, name: c.name })))),
  });

  protected readonly form = this.fb.group({
    courseId: [''],
    title: ['', trimmed([Validators.required, Validators.maxLength(200)])],
    description: ['', Validators.maxLength(5000)],
    notes: ['', Validators.maxLength(2000)],
    sessionMode: ['' as SessionMode | '', Validators.required],
    location: ['', [locationRule, Validators.maxLength(255)]],
    meetingUrl: [
      '',
      [
        meetingUrlRule,
        trimmed([Validators.pattern(MEETING_URL_PATTERN), Validators.maxLength(500)]),
      ],
    ],
    startDate: ['', Validators.required],
    recurring: [false],
    endDate: ['', endDateRule],
    startTime: ['', Validators.required],
    endTime: ['', [Validators.required, endTimeAfterStart]],
    timezone: [browserTimeZone(), trimmed([Validators.required, Validators.maxLength(60)])],
    capacity: ['', capacityRule],
    status: [TimeTableStatus.SCHEDULED as TimeTableStatus],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { initialValue: this.form.getRawValue() },
  );
  protected readonly mode = computed(() => this.value().sessionMode);
  protected readonly needsLocation = computed(() => {
    const mode = this.mode();
    return !!mode && mode !== SessionMode.ONLINE;
  });
  protected readonly needsMeetingUrl = computed(() => {
    const mode = this.mode();
    return !!mode && mode !== SessionMode.IN_PERSON;
  });
  protected readonly recurring = computed(() => this.value().recurring);
  /** "Repeats every Monday", from the first date. */
  protected readonly weekday = computed(() => {
    const day = dayOfWeekOf(this.value().startDate);
    return day ? day.charAt(0) + day.slice(1).toLowerCase() : null;
  });

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);

  /** Same key on every retry of this dialog, so a slow network never creates duplicates. */
  private readonly idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor() {
    // Cross-field rules: re-check the dependent controls when the other one changes.
    const c = this.form.controls;
    const recheck = (source: AbstractControl, ...targets: AbstractControl[]) =>
      source.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => targets.forEach((t) => t.updateValueAndValidity()));
    recheck(c.startTime, c.endTime);
    recheck(c.startDate, c.endDate);
    recheck(c.recurring, c.endDate);
    recheck(c.sessionMode, c.location, c.meetingUrl);
  }

  ngOnInit(): void {
    if (this.timeTableId()) {
      this.load();
    } else {
      this.form.controls.courseId.setValidators(Validators.required);
      this.form.controls.courseId.updateValueAndValidity();
    }
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected load(): void {
    const id = this.timeTableId();
    if (!id) return;
    this.loading.set(true);
    this.loadError.set(null);
    this.timeTables
      .getTimeTable(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (entry) => {
          this.original.set(entry);
          this.form.reset(toFormValue(entry));
        },
        error: (error: unknown) =>
          this.loadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this entry. Try again.',
          ),
      });
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.timeTableId();
    if (id) {
      const changes = this.changedFields();
      if (!Object.keys(changes).length) {
        this.serverError.set('Nothing to save: change a field first.');
        return;
      }
      this.save(this.timeTables.updateTimeTable(id, changes), 'update');
    } else {
      this.save(
        this.timeTables.createTimeTable(this.createPayload(), this.idempotencyKey),
        'create',
      );
    }
  }

  private save(request: Observable<TimeTableResponseDto>, kind: 'create' | 'update'): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (entry) =>
          this.done.emit({
            entry,
            message:
              kind === 'create'
                ? `“${entry.title}” was added to the timetable.`
                : `Changes to “${entry.title}” were saved.`,
          }),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  /** The request body as the form describes it, before comparing with the saved entry. */
  private normalized(v: FormValue) {
    const recurring = v.recurring;
    const mode = v.sessionMode as SessionMode;
    const capacity = v.capacity.trim();
    return {
      title: v.title.trim(),
      description: v.description.trim(),
      notes: v.notes.trim(),
      startDate: v.startDate,
      endDate: recurring ? v.endDate : '',
      startTime: v.startTime,
      endTime: v.endTime,
      timezone: v.timezone.trim(),
      recurring,
      dayOfWeek: recurring ? (dayOfWeekOf(v.startDate) ?? '') : '',
      sessionMode: mode,
      location: mode === SessionMode.ONLINE ? '' : v.location.trim(),
      meetingUrl: mode === SessionMode.IN_PERSON ? '' : v.meetingUrl.trim(),
      capacity: capacity ? Number(capacity) : null,
      status: v.status,
    };
  }

  /** Blank optional fields are left out so the API defaults apply. */
  private createPayload(): CreateTimeTableRequestDto {
    const v = this.normalized(this.form.getRawValue());
    const { status: _status, capacity, endDate, dayOfWeek, ...rest } = v;
    const payload: Record<string, unknown> = { courseId: this.form.controls.courseId.value };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== '') payload[key] = value;
    }
    if (v.recurring) {
      payload['endDate'] = endDate;
      payload['dayOfWeek'] = dayOfWeek;
    }
    if (capacity !== null) payload['capacity'] = capacity;
    return payload as unknown as CreateTimeTableRequestDto;
  }

  /** Only what differs from the saved entry. */
  private changedFields(): UpdateTimeTableRequestDto {
    const original = this.original();
    if (!original) return {};
    const after = this.normalized(this.form.getRawValue());
    const before = this.normalized(toFormValue(original));
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(after) as (keyof typeof after)[]) {
      const value = after[key];
      if (value === before[key]) continue;
      // Turning weekly off clears the day and last date on the server.
      if ((key === 'endDate' || key === 'dayOfWeek') && !after.recurring) continue;
      // Switching mode keeps the old location / link on record; there is nothing to send.
      if (key === 'location' && after.sessionMode === SessionMode.ONLINE) continue;
      if (key === 'meetingUrl' && after.sessionMode === SessionMode.IN_PERSON) continue;
      // The API cannot remove a capacity once set (blank means "keep").
      if (key === 'capacity' && value === null) continue;
      changes[key] = value;
    }
    return changes as UpdateTimeTableRequestDto;
  }
}

function toFormValue(t: TimeTableResponseDto): FormValue {
  return {
    courseId: t.courseId,
    title: t.title ?? '',
    description: t.description ?? '',
    notes: t.notes ?? '',
    sessionMode: t.sessionMode ?? '',
    location: t.location ?? '',
    meetingUrl: t.meetingUrl ?? '',
    startDate: t.startDate ?? '',
    recurring: !!t.recurring,
    endDate: t.endDate ?? '',
    startTime: shortTime(t.startTime),
    endTime: shortTime(t.endTime),
    timezone: t.timezone ?? 'UTC',
    capacity: t.capacity ? String(t.capacity) : '',
    status: t.status ?? TimeTableStatus.SCHEDULED,
  };
}
