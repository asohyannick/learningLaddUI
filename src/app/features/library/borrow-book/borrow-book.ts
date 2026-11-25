import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { LIBRARY_LIMITS, LibraryBookResponseDto, LibraryLoanResponseDto } from '../library.model';
import { LibraryService } from '../library.service';

/**
 * Reserve a copy (`POST /library/loans`) for the signed-in student. The copy is held for 48 hours
 * until a librarian issues it. One Idempotency-Key per dialog, so a retry never reserves twice.
 */
@Component({
  selector: 'app-borrow-book',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [heading]="'Borrow “' + book().title + '”'"
      [description]="
        'We hold a copy for you for ' +
        holdHours +
        ' hours. Pick it up at the library desk' +
        (book().shelfLocation ? ' (shelf ' + book().shelfLocation + ')' : '') +
        '. You can borrow up to ' +
        maxLoans +
        ' books at a time.'
      "
      [busy]="saving()"
      (closed)="cancelled.emit()"
    >
      @if (error(); as message) {
        <app-form-alert class="mb-4">{{ message }}</app-form-alert>
      }
      <dl class="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted">Loan period</dt>
          <dd>{{ book().loanPeriodDays }} days</dd>
        </div>
        <div>
          <dt class="text-xs uppercase tracking-wide text-muted">Renewals</dt>
          <dd>Up to {{ book().maxRenewals }}</dd>
        </div>
      </dl>
      <label for="borrow-notes" class="mb-1.5 block text-sm font-medium">
        Note for the librarian <span class="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="borrow-notes"
        rows="3"
        maxlength="1000"
        [class]="inputClasses(false)"
        [value]="notes()"
        (input)="notes.set($any($event.target).value)"
      ></textarea>
      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
          [disabled]="saving()"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          [disabled]="saving()"
          (click)="confirm()"
        >
          {{ saving() ? 'Reserving…' : 'Reserve a copy' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class BorrowBook {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly book = input.required<LibraryBookResponseDto>();
  /** Emits the reservation and the API's message (with the pick-up deadline). */
  readonly done = output<{ loan: LibraryLoanResponseDto; message: string }>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;
  protected readonly holdHours = LIBRARY_LIMITS.reservationHoldHours;
  protected readonly maxLoans = LIBRARY_LIMITS.maxActiveLoansPerStudent;
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly idempotencyKey = crypto.randomUUID();

  protected confirm(): void {
    this.error.set(null);
    this.saving.set(true);
    const notes = this.notes().trim();
    this.library
      .borrowBook({ bookId: this.book().id, ...(notes ? { notes } : {}) }, this.idempotencyKey)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.done.emit({ loan: res.data, message: res.message }),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not reserve this book. Try again.',
          ),
      });
  }
}
