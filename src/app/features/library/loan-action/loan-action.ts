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
import { IssueBookRequestDto, LibraryLoanResponseDto } from '../library.model';
import {
  LOAN_ACTION_LABELS,
  LibraryService,
  LoanAction,
  LoanMode,
  libraryDate,
  todayLocal,
} from '../library.service';

export interface LoanActionDone {
  message: string;
  loan: LibraryLoanResponseDto | null;
}

type FeeChoice = 'calculate' | 'waive' | 'override';

const MONEY = /^\d{1,10}(\.\d{1,2})?$/;

@Component({
  selector: 'app-loan-action',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loan-action.html',
})
export class LoanActionDialog {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly action = input.required<LoanAction>();
  readonly loan = input.required<LibraryLoanResponseDto>();
  readonly mode = input<LoanMode>('staff');
  readonly done = output<LoanActionDone>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;
  protected readonly today = todayLocal();

  protected readonly condition = signal('');
  protected readonly dueDate = signal('');
  protected readonly notes = signal('');
  protected readonly returnedOn = signal('');
  protected readonly feeChoice = signal<FeeChoice>('calculate');
  protected readonly feeOverride = signal('');
  protected readonly feePaid = signal(false);
  protected readonly description = signal('');
  protected readonly replacementFee = signal('');

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitted = signal(false);

  protected readonly label = computed(() => LOAN_ACTION_LABELS[this.action()]);
  protected readonly danger = computed(() => ['delete', 'lost', 'cancel'].includes(this.action()));
  protected readonly heading = computed(() => {
    const title = this.loan().bookTitle;
    switch (this.action()) {
      case 'issue':
        return `Issue “${title}”`;
      case 'update':
        return `Update the loan of “${title}”`;
      case 'confirm':
        return `Confirm “${title}” is back`;
      case 'renew':
        return `Renew “${title}”?`;
      case 'return':
        return `Return “${title}”`;
      case 'cancel':
        return 'Cancel this reservation?';
      case 'lost':
        return `Report “${title}” lost`;
      default:
        return 'Delete this loan record?';
    }
  });
  protected readonly description_ = computed(() => {
    const loan = this.loan();
    switch (this.action()) {
      case 'issue':
        return `Hand the book to the student. Reserved until ${libraryDate(loan.reservationExpiresAt)}. The due date defaults to today plus the book's loan period.`;
      case 'update':
        return 'Correct the due date, the condition or add a note. A new future due date clears the overdue status.';
      case 'confirm':
        return 'The copy goes back on the shelf and the late fee is finalized.';
      case 'renew':
        return `The due date (${libraryDate(loan.dueAt)}) moves forward by the book's loan period. Overdue books and books at their renewal limit cannot be renewed.`;
      case 'return':
        return 'Hand the book in at the library desk. Late fees stop now; a librarian confirms once the copy is checked.';
      case 'cancel':
        return `The reserved copy of “${loan.bookTitle}” goes back on the shelf.`;
      case 'lost':
        return this.mode() === 'staff'
          ? 'Late fees up to today are charged, plus any replacement fee. The copy is removed from the catalog total.'
          : 'Late fees up to today are charged and the library may contact you about a replacement.';
      default:
        return `${loan.loanReference} will be removed for good. Only finished loans can be deleted.`;
    }
  });

  protected readonly problems = computed(() => {
    const p: Partial<
      Record<
        | 'condition'
        | 'dueDate'
        | 'returnedOn'
        | 'feeOverride'
        | 'description'
        | 'replacementFee'
        | 'nothing',
        string
      >
    > = {};
    const a = this.action();
    if (a === 'confirm' && !this.condition().trim())
      p.condition = 'Describe the condition of the returned copy.';
    if ((a === 'issue' || a === 'update') && this.dueDate() && this.dueDate() <= this.today) {
      p.dueDate = 'The due date must be in the future.';
    }
    if (a === 'update' && !this.condition().trim() && !this.dueDate() && !this.notes().trim()) {
      p.nothing = 'Change the due date, the condition or add a note.';
    }
    if (a === 'confirm' && this.returnedOn() && this.returnedOn() > this.today) {
      p.returnedOn = 'The return date cannot be in the future.';
    }
    if (
      a === 'confirm' &&
      this.feeChoice() === 'override' &&
      !MONEY.test(this.feeOverride().trim())
    ) {
      p.feeOverride = 'Enter an amount like 2.50.';
    }
    if (a === 'lost' && !this.description().trim()) p.description = 'Say what happened.';
    if (a === 'lost' && this.replacementFee().trim() && !MONEY.test(this.replacementFee().trim())) {
      p.replacementFee = 'Enter an amount like 25.00.';
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

  private request(): Observable<LoanActionDone> {
    const id = this.loan().id;
    const text = (value: string) => value.trim() || undefined;
    const loanUpdate = (): IssueBookRequestDto =>
      clean({
        conditionOnBorrow: text(this.condition()),
        dueAt: this.dueDate() ? endOfDay(this.dueDate()) : undefined,
        notes: text(this.notes()),
      });
    const withLoan = (source: Observable<{ message: string; data: LibraryLoanResponseDto }>) =>
      source.pipe(map((res) => ({ message: res.message, loan: res.data })));

    switch (this.action()) {
      case 'issue':
        return withLoan(this.library.issueBook(id, loanUpdate()));
      case 'update':
        return withLoan(this.library.updateLoan(id, loanUpdate()));
      case 'confirm': {
        const choice = this.feeChoice();
        return withLoan(
          this.library.confirmReturn(
            id,
            clean({
              conditionOnReturn: this.condition().trim(),
              returnedAt: this.returnedOn() ? endOfDayOrNow(this.returnedOn()) : undefined,
              waiveLateFee: choice === 'waive' ? true : undefined,
              lateFeeOverride: choice === 'override' ? Number(this.feeOverride()) : undefined,
              feePaid: this.feePaid() || undefined,
              notes: text(this.notes()),
            }),
          ),
        );
      }
      case 'renew':
        return withLoan(this.library.renewLoan(id));
      case 'return':
        return withLoan(this.library.returnLoan(id, clean({ note: text(this.notes()) })));
      case 'cancel':
        return withLoan(this.library.cancelReservation(id));
      case 'lost':
        return withLoan(
          this.library.reportLost(
            id,
            clean({
              description: this.description().trim(),
              replacementFee:
                this.mode() === 'staff' && this.replacementFee().trim()
                  ? Number(this.replacementFee())
                  : undefined,
            }),
          ),
        );
      default:
        return this.library.deleteLoan(id).pipe(map((message) => ({ message, loan: null })));
    }
  }
}

function clean<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}

function endOfDayOrNow(date: string): string {
  const end = new Date(`${date}T23:59:59`);
  return (end.getTime() > Date.now() ? new Date() : end).toISOString();
}
