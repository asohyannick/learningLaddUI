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
import { RouterLink } from '@angular/router';
import { FetchAllLoans, LoanActionRequest } from '../fetch-all-loans/fetch-all-loans';
import { FetchLoan } from '../fetch-loan/fetch-loan';
import { LoanActionDialog, LoanActionDone } from '../loan-action/loan-action';
import { LoanMode } from '../library.service';
import { StudentIdentityStore } from '../student-identity.store';

/**
 * Loans section. Staff: every loan, with issue, update, confirm return, cancel, report lost,
 * delete, search, count and PDF. Students ("My loans"): their own loans, with renew, return,
 * cancel and report lost.
 */
@Component({
  selector: 'app-loan-manager',
  imports: [FetchAllLoans, FetchLoan, LoanActionDialog, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'student' && !studentId()) {
      <div class="rounded-2xl border border-white/10 bg-navy-900 p-8 text-center text-slate-300">
        <p class="text-base font-semibold text-white">No loans to show yet</p>
        <p class="mx-auto mt-1 max-w-md text-sm">
          Your loans appear here once you borrow a book from the Library section. You need a student
          profile to borrow; create it under My profile.
        </p>
        <a
          routerLink="."
          [queryParams]="{ section: 'library' }"
          class="mt-4 inline-block rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-dark"
          >Browse the library</a
        >
      </div>
    } @else {
      <app-fetch-all-loans
        [mode]="mode()"
        [studentId]="studentId()"
        (view)="selectedId.set($event.id)"
        (act)="dialog.set($event)"
      />
    }

    @if (selectedId(); as id) {
      <app-fetch-loan
        [loanId]="id"
        [mode]="mode()"
        (closed)="selectedId.set(null)"
        (act)="dialog.set($event)"
      />
    }

    @if (dialog(); as d) {
      <app-loan-action
        [action]="d.action"
        [loan]="d.loan"
        [mode]="mode()"
        (done)="onDone(d, $event)"
        (cancelled)="dialog.set(null)"
      />
    }
  `,
})
export class LoanManager {
  private readonly identity = inject(StudentIdentityStore);

  readonly mode = input<LoanMode>('staff');
  readonly notify = output<string>();

  protected readonly studentId = computed(() =>
    this.mode() === 'student' ? this.identity.studentProfileId() : null,
  );
  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<LoanActionRequest | null>(null);

  private readonly list = viewChild(FetchAllLoans);
  private readonly panel = viewChild(FetchLoan);

  protected onDone(request: LoanActionRequest, result: LoanActionDone): void {
    this.dialog.set(null);
    if (result.loan) {
      this.panel()?.show(result.loan);
    } else if (this.selectedId() === request.loan.id) {
      this.selectedId.set(null);
    }
    this.list()?.reload();
    this.notify.emit(result.message);
  }
}
