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
import { Observable, finalize, map } from 'rxjs';
import { ApiResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { FieldError } from '../../../shared/reusable-components/field-error/field-error';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { applyServerErrors, trimmed } from '../../../shared/validators/form-validators';
import { CourseService } from '../../course/course.service';
import { TutorProfileService, tutorName } from '../../tutor-profile/tutor-profile.service';
import {
  BOOKING_MAX_DURATION_MINUTES,
  BOOKING_MIN_DURATION_MINUTES,
  BOOKING_SESSION_MODES,
  BookingResponseDto,
  CreateBookingRequestDto,
  SessionMode,
  UpdateBookingRequestDto,
} from '../booking.model';
import { BookingService, needsMeetingLink } from '../booking.service';

function localParts(iso?: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function scheduleRule(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  if (!group) return null;
  const date = group.get('date')?.value as string;
  const start = group.get('startTime')?.value as string;
  const end = control.value as string;
  if (!date || !start || !end) return null;
  const minutes = (Date.parse(`${date}T${end}:00`) - Date.parse(`${date}T${start}:00`)) / 60_000;
  if (minutes < BOOKING_MIN_DURATION_MINUTES || minutes > BOOKING_MAX_DURATION_MINUTES) {
    return { sessionLength: true };
  }
  return null;
}

function futureStart(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  const date = group?.get('date')?.value as string;
  const start = control.value as string;
  if (!date || !start) return null;
  return Date.parse(`${date}T${start}:00`) > Date.now() ? null : { pastStart: true };
}

function placeRule(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  if (!group || group.get('sessionMode')?.value !== SessionMode.IN_PERSON) return null;
  const name = (group.get('locationName')?.value as string).trim();
  const address = (group.get('addressLine')?.value as string).trim();
  return name || address ? null : { placeRequired: true };
}

const TEXT_FIELDS = [
  'topic',
  'studentNotes',
  'meetingPlatform',
  'locationName',
  'addressLine',
  'city',
  'country',
  'locationInstructions',
] as const;

@Component({
  selector: 'app-booking-form',
  imports: [EnumLabelPipe, FieldError, FormAlert, Modal, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './booking-form.html',
})
export class BookingForm implements OnInit {
  private readonly bookings = inject(BookingService);
  private readonly tutors = inject(TutorProfileService);
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly existing = input<BookingResponseDto | null>(null);
  readonly done = output<{ message: string; booking: BookingResponseDto }>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;
  protected readonly modes = BOOKING_SESSION_MODES;
  protected readonly isEdit = computed(() => !!this.existing());
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  protected readonly today = localParts(new Date().toISOString()).date;

  protected readonly tutorOptions = rxResource({
    stream: () =>
      this.tutors
        .searchProfiles({ page: 0, size: 100, sortBy: 'lastName', sortDirection: 'asc' })
        .pipe(map((page) => page.content.map((t) => ({ id: t.id, name: tutorName(t) })))),
  });
  protected readonly courseOptions = rxResource({
    stream: () =>
      this.courses
        .searchCourses({ page: 0, size: 100, sortBy: 'name', sortDirection: 'asc' })
        .pipe(map((page) => page.content.map((c) => ({ id: c.id, name: c.name })))),
  });

  protected readonly form = this.fb.group({
    tutorId: ['', Validators.required],
    courseId: [''],
    topic: ['', trimmed([Validators.required, Validators.maxLength(200)])],
    studentNotes: ['', Validators.maxLength(5000)],
    date: ['', Validators.required],
    startTime: ['', [Validators.required, futureStart]],
    endTime: ['', [Validators.required, scheduleRule]],
    sessionMode: [SessionMode.ONLINE as SessionMode],
    meetingPlatform: ['', Validators.maxLength(50)],
    locationName: ['', [Validators.maxLength(200), placeRule]],
    addressLine: ['', Validators.maxLength(255)],
    city: ['', Validators.maxLength(100)],
    country: ['', Validators.maxLength(100)],
    locationInstructions: ['', Validators.maxLength(500)],
  });

  private readonly mode = toSignal(this.form.controls.sessionMode.valueChanges, {
    initialValue: SessionMode.ONLINE,
  });
  protected readonly online = computed(() => needsMeetingLink(this.mode()));
  protected readonly inPerson = computed(() => this.mode() !== SessionMode.ONLINE);

  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private readonly idempotencyKey = crypto.randomUUID();

  constructor() {
    const c = this.form.controls;
    const recheck = (targets: AbstractControl[]) => () =>
      targets.forEach((t) => t.updateValueAndValidity());
    for (const source of [c.date, c.startTime]) {
      source.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(recheck([c.startTime, c.endTime]));
    }
    for (const source of [c.sessionMode, c.addressLine]) {
      source.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(recheck([c.locationName]));
    }
  }

  ngOnInit(): void {
    const b = this.existing();
    if (!b) return;
    this.form.reset(this.toFormValue(b));
    this.form.controls.tutorId.disable();
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  protected submit(): void {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const existing = this.existing();
    if (existing) {
      const changes = this.changes(existing);
      if (!Object.keys(changes).length) {
        this.serverError.set('Nothing to save: change a field first.');
        return;
      }
      this.save(this.bookings.updateBooking(existing.id!, changes));
    } else {
      this.save(this.bookings.addBooking(this.createPayload(), this.idempotencyKey));
    }
  }

  private save(request: Observable<ApiResponse<BookingResponseDto>>): void {
    this.submitting.set(true);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit({ message: res.message, booking: res.data }),
        error: (error: unknown) => this.serverError.set(applyServerErrors(this.form, error)),
      });
  }

  private createPayload(): CreateBookingRequestDto {
    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      tutorId: v.tutorId,
      scheduledStart: toInstant(v.date, v.startTime),
      scheduledEnd: toInstant(v.date, v.endTime),
      timeZone: this.timeZone,
      sessionMode: v.sessionMode,
    };
    if (v.courseId) payload['courseId'] = v.courseId;
    for (const key of TEXT_FIELDS) {
      if (!this.applies(key, v.sessionMode)) continue;
      const value = v[key].trim();
      if (value) payload[key] = value;
    }
    return payload as unknown as CreateBookingRequestDto;
  }

  private changes(b: BookingResponseDto): UpdateBookingRequestDto {
    const before = this.toFormValue(b);
    const v = this.form.getRawValue();
    const changes: Record<string, unknown> = {};
    if (v.courseId && v.courseId !== before.courseId) changes['courseId'] = v.courseId;
    if (v.sessionMode !== before.sessionMode) changes['sessionMode'] = v.sessionMode;
    if (
      v.date !== before.date ||
      v.startTime !== before.startTime ||
      v.endTime !== before.endTime
    ) {
      changes['scheduledStart'] = toInstant(v.date, v.startTime);
      changes['scheduledEnd'] = toInstant(v.date, v.endTime);
      changes['timeZone'] = this.timeZone;
    }
    for (const key of TEXT_FIELDS) {
      const value = v[key].trim();
      if (value !== before[key].trim()) changes[key] = value;
    }
    return changes as UpdateBookingRequestDto;
  }

  private applies(key: (typeof TEXT_FIELDS)[number], mode: SessionMode): boolean {
    if (key === 'meetingPlatform') return needsMeetingLink(mode);
    if (['locationName', 'addressLine', 'city', 'country', 'locationInstructions'].includes(key)) {
      return mode !== SessionMode.ONLINE;
    }
    return true;
  }

  private toFormValue(b: BookingResponseDto) {
    const start = localParts(b.scheduledStart);
    const end = localParts(b.scheduledEnd);
    return {
      tutorId: b.tutorId ?? '',
      courseId: b.courseId ?? '',
      topic: b.topic ?? '',
      studentNotes: b.studentNotes ?? '',
      date: start.date,
      startTime: start.time,
      endTime: end.time,
      sessionMode: b.sessionMode ?? SessionMode.ONLINE,
      meetingPlatform: b.meetingPlatform ?? '',
      locationName: b.locationName ?? '',
      addressLine: b.addressLine ?? '',
      city: b.city ?? '',
      country: b.country ?? '',
      locationInstructions: b.locationInstructions ?? '',
    };
  }
}
