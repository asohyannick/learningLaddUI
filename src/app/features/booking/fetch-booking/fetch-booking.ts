import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { BookingResponseDto } from '../booking.model';
import {
  BookingService,
  bookingDate,
  bookingDuration,
  bookingPlace,
  bookingStatusClasses,
  bookingWhen,
} from '../booking.service';
import {
  BookingActionRequest,
  BookingMode,
  bookingActions,
} from '../fetch-all-bookings/fetch-all-bookings';

const LABELS = {
  approve: 'Approve',
  decline: 'Decline',
  edit: 'Edit booking',
  delete: 'Delete',
} as const;

/** Side panel: one booking (`GET /booking/{id}`) with the actions its status allows. */
@Component({
  selector: 'app-fetch-booking',
  imports: [EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="fixed inset-0 z-40">
      <div
        class="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
        (click)="closed.emit()"
      ></div>
      <aside
        class="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/10 bg-navy-900 text-slate-200 shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="booking-panel-title" class="text-base font-semibold text-white">Booking</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close booking"
            (click)="closed.emit()"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          @if (loading() && !booking()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading booking">
              <div class="h-6 w-2/3 rounded bg-white/10"></div>
              @for (row of [1, 2, 3]; track row) {
                <div class="h-10 rounded-lg bg-white/5"></div>
              }
            </div>
          } @else if (error(); as message) {
            <div
              class="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"
              role="alert"
            >
              <p>{{ message }}</p>
              <button type="button" class="mt-2 font-semibold underline" (click)="load()">
                Try again
              </button>
            </div>
          } @else if (booking(); as b) {
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                [class]="statusClasses()"
                >{{ b.status | enumLabel }}</span
              >
              <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300">{{
                b.sessionMode | enumLabel
              }}</span>
            </div>
            <h3 class="mt-3 text-xl font-semibold text-white">{{ b.topic }}</h3>
            <p class="mt-1 text-sm text-slate-400">
              {{ b.bookingReference }} · with {{ tutorName() }}
            </p>

            @if (b.rejectionReason) {
              <p class="mt-4 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                Declined: {{ b.rejectionReason }}
              </p>
            }

            <dl class="mt-6 grid gap-3 text-sm">
              @for (item of facts(); track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
              @if (b.meetingLink) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">Meeting link</dt>
                  <dd class="mt-0.5 break-all">
                    <a
                      [href]="b.meetingLink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-medium text-indigo-300 underline"
                      >{{ b.meetingLink }}</a
                    >
                  </dd>
                </div>
              }
            </dl>
            @for (section of notes(); track section.title) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {{ section.title }}
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ section.text }}</p>
              </section>
            }
          }
        </div>

        @if (booking(); as b) {
          @if (actions().length) {
            <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
              @for (item of actions(); track item.action; let first = $first) {
                <button
                  type="button"
                  class="rounded-lg px-4 py-2.5 text-sm font-semibold"
                  [class]="
                    item.action === 'approve'
                      ? 'flex-1 bg-emerald-500 text-white hover:bg-emerald-600'
                      : item.action === 'edit'
                        ? 'flex-1 bg-royal text-white hover:bg-royal-dark'
                        : 'border border-rose-400/40 text-rose-300 hover:bg-rose-400/10'
                  "
                  (click)="act.emit({ action: item.action, booking: b })"
                >
                  {{ item.label }}
                </button>
              }
            </footer>
          }
        }
      </aside>
    </div>
  `,
})
export class FetchBooking {
  private readonly bookings = inject(BookingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly bookingId = input.required<string>();
  readonly mode = input<BookingMode>('staff');
  /** Tutor names by tutor profile ID, from the list. */
  readonly tutorNames = input<ReadonlyMap<string, string>>(new Map());
  readonly closed = output<void>();
  readonly act = output<BookingActionRequest>();

  protected readonly booking = signal<BookingResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly statusClasses = computed(() => bookingStatusClasses(this.booking()?.status));
  protected readonly tutorName = computed(() => {
    const id = this.booking()?.tutorId;
    return (id && this.tutorNames().get(id)) || 'the tutor';
  });
  protected readonly actions = computed(() => {
    const b = this.booking();
    return b
      ? bookingActions(b, this.mode()).map((action) => ({ action, label: LABELS[action] }))
      : [];
  });
  protected readonly facts = computed(() => {
    const b = this.booking();
    if (!b) return [];
    return [
      { label: 'When', value: bookingWhen(b) },
      { label: 'Length', value: bookingDuration(b.durationMinutes) },
      { label: 'Place', value: bookingPlace(b) },
      { label: 'Directions', value: b.locationInstructions ?? '' },
      { label: 'Platform', value: b.meetingPlatform ?? '' },
      {
        label: 'Meeting ID',
        value: [b.meetingId, b.meetingPasscode ? `passcode ${b.meetingPasscode}` : '']
          .filter(Boolean)
          .join(', '),
      },
      {
        label: 'Rescheduled',
        value: b.rescheduleCount
          ? `${b.rescheduleCount}×, last ${bookingDate(b.lastRescheduledAt)}`
          : '',
      },
      { label: 'Confirmed', value: bookingDate(b.confirmedAt) },
      { label: 'Requested', value: bookingDate(b.createdAt) },
    ].filter((f) => f.value);
  });
  protected readonly notes = computed(() => {
    const b = this.booking();
    if (!b) return [];
    return [
      { title: 'Student notes', text: b.studentNotes },
      { title: 'Tutor notes', text: b.tutorNotes },
      { title: 'Cancellation', text: b.cancellationReason },
    ].filter((s): s is { title: string; text: string } => !!s.text);
  });

  constructor() {
    effect(() => {
      const id = this.bookingId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  show(booking: BookingResponseDto): void {
    this.booking.set(booking);
  }

  load(id: string = this.bookingId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.bookings
      .getBooking(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (booking) => {
          this.booking.set(booking);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.booking.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this booking. Try again.',
          );
          this.loading.set(false);
        },
      });
  }
}
