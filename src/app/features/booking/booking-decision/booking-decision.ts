import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { BookingResponseDto, MEETING_LINK_PATTERN } from '../booking.model';
import { BookingService, bookingWhen, needsMeetingLink } from '../booking.service';

export type BookingDecisionKind = 'approve' | 'decline' | 'delete';

export interface BookingDecisionDone {
  message: string;
  /** The updated booking, or null when it was deleted. */
  booking: BookingResponseDto | null;
}

/** Approve (`/approve`), decline (`/disapprove`) or delete a booking. */
@Component({
  selector: 'app-booking-decision',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [heading]="heading()"
      [description]="description()"
      [tone]="kind() === 'approve' ? 'default' : 'danger'"
      [busy]="saving()"
      (closed)="cancelled.emit()"
    >
      @if (error(); as message) {
        <app-form-alert class="mb-4">{{ message }}</app-form-alert>
      }
      @let p = problems();
      <form class="space-y-4 text-sm" novalidate (submit)="$event.preventDefault(); submit()">
        @if (kind() === 'approve') {
          <div>
            <label for="bd-link" class="mb-1.5 block font-medium">
              Meeting link
              @if (!linkRequired()) {
                <span class="font-normal text-muted">(optional)</span>
              }
            </label>
            <input
              id="bd-link"
              inputmode="url"
              maxlength="500"
              placeholder="https://meet.example.com/abc"
              [class]="inputClasses(submitted() && !!p.link)"
              [value]="link()"
              (input)="link.set($any($event.target).value)"
            />
            @if (submitted() && p.link) {
              <p class="mt-1 text-sm text-red-600">{{ p.link }}</p>
            }
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="bd-meeting-id" class="mb-1.5 block font-medium">
                Meeting ID <span class="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="bd-meeting-id"
                maxlength="100"
                [class]="inputClasses(false)"
                [value]="meetingId()"
                (input)="meetingId.set($any($event.target).value)"
              />
            </div>
            <div>
              <label for="bd-passcode" class="mb-1.5 block font-medium">
                Passcode <span class="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="bd-passcode"
                maxlength="100"
                [class]="inputClasses(false)"
                [value]="passcode()"
                (input)="passcode.set($any($event.target).value)"
              />
            </div>
          </div>
          <div>
            <label for="bd-notes" class="mb-1.5 block font-medium">
              Note for the student <span class="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="bd-notes"
              rows="3"
              maxlength="2000"
              [class]="inputClasses(false)"
              [value]="notes()"
              (input)="notes.set($any($event.target).value)"
            ></textarea>
          </div>
        } @else if (kind() === 'decline') {
          <div>
            <label for="bd-reason" class="mb-1.5 block font-medium"
              >Reason (shown to the student)</label
            >
            <textarea
              id="bd-reason"
              rows="3"
              maxlength="500"
              placeholder="e.g. The tutor is away that week; please pick another date."
              [class]="inputClasses(submitted() && !!p.reason)"
              [value]="reason()"
              (input)="reason.set($any($event.target).value)"
            ></textarea>
            @if (submitted() && p.reason) {
              <p class="mt-1 text-sm text-red-600">{{ p.reason }}</p>
            }
          </div>
        }
        <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-line px-4 py-2.5 font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
            [disabled]="saving()"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            [class]="
              kind() === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            "
            [disabled]="saving()"
          >
            {{ saving() ? 'Saving…' : label() }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class BookingDecision {
  private readonly bookings = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly kind = input.required<BookingDecisionKind>();
  readonly booking = input.required<BookingResponseDto>();
  readonly done = output<BookingDecisionDone>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;
  protected readonly link = signal('');
  protected readonly meetingId = signal('');
  protected readonly passcode = signal('');
  protected readonly notes = signal('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Online and hybrid sessions need a link, unless the booking already has one. */
  protected readonly linkRequired = computed(
    () => needsMeetingLink(this.booking().sessionMode) && !this.booking().meetingLink,
  );
  protected readonly label = computed(
    () =>
      ({ approve: 'Approve booking', decline: 'Decline booking', delete: 'Delete booking' })[
        this.kind()
      ],
  );
  protected readonly heading = computed(() => {
    const topic = this.booking().topic ?? 'this session';
    return {
      approve: `Approve “${topic}”`,
      decline: `Decline “${topic}”`,
      delete: 'Delete this booking?',
    }[this.kind()];
  });
  protected readonly description = computed(() => {
    const b = this.booking();
    return {
      approve: `${bookingWhen(b)}. The student is told it is confirmed.`,
      decline: `${bookingWhen(b)}. The student sees your reason and can book another time.`,
      delete: `${b.bookingReference} will be removed for good. This cannot be undone.`,
    }[this.kind()];
  });
  protected readonly problems = computed(() => {
    const p: { link?: string; reason?: string } = {};
    const link = this.link().trim();
    if (this.kind() === 'approve') {
      if (this.linkRequired() && !link)
        p.link = `Add a meeting link for this ${this.booking().sessionMode?.toLowerCase().replace('_', ' ')} session.`;
      else if (link && !MEETING_LINK_PATTERN.test(link))
        p.link = 'The link must start with https://';
    }
    if (this.kind() === 'decline') {
      const reason = this.reason().trim();
      if (reason.length < 5) p.reason = 'Give a reason of at least 5 characters.';
    }
    return p;
  });

  protected submit(): void {
    this.submitted.set(true);
    this.error.set(null);
    if (Object.keys(this.problems()).length) return;
    this.saving.set(true);
    this.request()
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.done.emit(result),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Something went wrong. Try again.',
          ),
      });
  }

  private request(): Observable<BookingDecisionDone> {
    const id = this.booking().id!;
    const text = (value: string) => value.trim() || undefined;
    const toDone = map((res: { message: string; data: BookingResponseDto }) => ({
      message: res.message,
      booking: res.data,
    }));
    switch (this.kind()) {
      case 'approve': {
        const body = Object.fromEntries(
          Object.entries({
            meetingLink: text(this.link()),
            meetingId: text(this.meetingId()),
            meetingPasscode: text(this.passcode()),
            tutorNotes: text(this.notes()),
          }).filter(([, v]) => v !== undefined),
        );
        return this.bookings.approveBooking(id, body).pipe(toDone);
      }
      case 'decline':
        return this.bookings.disapproveBooking(id, { reason: this.reason().trim() }).pipe(toDone);
      default:
        return this.bookings.deleteBooking(id).pipe(map((message) => ({ message, booking: null })));
    }
  }
}
