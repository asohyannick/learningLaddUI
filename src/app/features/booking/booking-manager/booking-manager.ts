import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';

const TUTOR_ROLES = [UserRole.LECTURER, UserRole.PROFESSOR, UserRole.ASSISTANT_LECTURER];
import {
  BookingDecision,
  BookingDecisionDone,
  BookingDecisionKind,
} from '../booking-decision/booking-decision';
import { BookingForm } from '../booking-form/booking-form';
import { BookingResponseDto } from '../booking.model';
import {
  BookingActionRequest,
  BookingMode,
  FetchAllBookings,
} from '../fetch-all-bookings/fetch-all-bookings';
import { FetchBooking } from '../fetch-booking/fetch-booking';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; booking: BookingResponseDto }
  | { kind: BookingDecisionKind; booking: BookingResponseDto };

/**
 * Bookings section. Staff (admin dashboard): every booking; approve, decline, delete, search,
 * count and PDF. Students: their own bookings; book a tutor, edit or reschedule, delete, PDF.
 */
@Component({
  selector: 'app-booking-manager',
  imports: [BookingDecision, BookingForm, FetchAllBookings, FetchBooking],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-bookings
      [mode]="mode()"
      [studentId]="studentId()"
      [tutorView]="tutorView()"
      (add)="dialog.set({ kind: 'create' })"
      (view)="selectedId.set($event.id ?? null)"
      (act)="onAction($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-booking
        [bookingId]="id"
        [mode]="mode()"
        [tutorNames]="tutorNames()"
        (closed)="selectedId.set(null)"
        (act)="onAction($event)"
      />
    }

    @if (dialog(); as d) {
      @switch (d.kind) {
        @case ('create') {
          <app-booking-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
        }
        @case ('edit') {
          <app-booking-form
            [existing]="$any(d).booking"
            (done)="onSaved($event)"
            (cancelled)="dialog.set(null)"
          />
        }
        @default {
          <app-booking-decision
            [kind]="$any(d.kind)"
            [booking]="$any(d).booking"
            (done)="onDecided($any(d).booking, $event)"
            (cancelled)="dialog.set(null)"
          />
        }
      }
    }
  `,
})
export class BookingManager {
  private readonly auth = inject(AuthService);
  private readonly user = this.auth.user;

  /** Lecturers, professors and assistant lecturers only see the bookings made with them. */
  protected readonly tutorView = computed(() => {
    this.auth.role();
    return this.mode() === 'staff' && this.auth.hasAnyRole(TUTOR_ROLES);
  });

  readonly mode = input<BookingMode>('staff');
  readonly notify = output<string>();

  /** Bookings store the student's user ID. */
  protected readonly studentId = computed(() =>
    this.mode() === 'student' ? (this.user()?.id ?? null) : null,
  );
  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllBookings);
  private readonly panel = viewChild(FetchBooking);

  protected readonly tutorNames = computed(() => {
    const options = this.list().tutorOptionsMap();
    return options;
  });

  protected onAction(request: BookingActionRequest): void {
    this.dialog.set({ kind: request.action, booking: request.booking });
  }

  protected onSaved(result: { message: string; booking: BookingResponseDto }): void {
    this.dialog.set(null);
    this.panel()?.show(result.booking);
    this.list().reload();
    this.notify.emit(result.message);
  }

  protected onDecided(booking: BookingResponseDto, result: BookingDecisionDone): void {
    this.dialog.set(null);
    if (result.booking) {
      this.panel()?.show(result.booking);
    } else if (this.selectedId() === booking.id) {
      this.selectedId.set(null);
    }
    this.list().reload();
    this.notify.emit(result.message);
  }
}
