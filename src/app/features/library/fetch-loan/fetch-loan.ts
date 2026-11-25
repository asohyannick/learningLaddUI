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
import { Subscription, finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { LibraryLoanResponseDto, daysOverdue } from '../library.model';
import {
  LOAN_ACTION_LABELS,
  LibraryService,
  LoanMode,
  libraryDate,
  loanActions,
  loanStatusClasses,
  money,
} from '../library.service';
import { LoanActionRequest } from '../fetch-all-loans/fetch-all-loans';

@Component({
  selector: 'app-fetch-loan',
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
        aria-labelledby="loan-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="loan-panel-title" class="text-base font-semibold text-white">Loan</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close loan"
            (click)="closed.emit()"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          @if (loading() && !loan()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading loan">
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
          } @else if (loan(); as l) {
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
              [class]="statusClasses()"
              >{{ l.status | enumLabel }}</span
            >
            <h3 class="mt-3 text-xl font-semibold text-white">{{ l.bookTitle }}</h3>
            <p class="mt-1 text-sm text-slate-400">
              {{ l.loanReference }}
              @if (l.bookIsbn) {
                · ISBN {{ l.bookIsbn }}
              }
            </p>
            @if (overdueDays() > 0) {
              <p class="mt-3 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                {{ overdueDays() }} day{{ overdueDays() === 1 ? '' : 's' }} overdue. Late fees are
                adding up.
              </p>
            }

            <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              @for (item of facts(); track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
            </dl>
            @if (l.returnRequestNote) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Return note
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">
                  {{ l.returnRequestNote }}
                </p>
              </section>
            }
            @if (l.notes) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ l.notes }}</p>
              </section>
            }
            @if (downloadError(); as message) {
              <p class="mt-4 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (loan(); as l) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            @for (item of actions(); track item.action; let first = $first) {
              <button
                type="button"
                class="rounded-lg px-4 py-2.5 text-sm font-semibold"
                [class]="
                  item.action === 'delete' || item.action === 'lost'
                    ? 'border border-rose-400/40 text-rose-300 hover:bg-rose-400/10'
                    : first
                      ? 'flex-1 bg-royal text-white hover:bg-royal-dark'
                      : 'border border-white/10 text-slate-200 hover:bg-white/5'
                "
                (click)="act.emit({ action: item.action, loan: l })"
              >
                {{ item.label }}
              </button>
            }
            @if (mode() === 'staff') {
              <button
                type="button"
                class="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
                [disabled]="downloading()"
                (click)="download(l)"
              >
                {{ downloading() ? 'PDF…' : 'PDF' }}
              </button>
            }
          </footer>
        }
      </aside>
    </div>
  `,
})
export class FetchLoan {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly loanId = input.required<string>();
  readonly mode = input<LoanMode>('staff');
  readonly closed = output<void>();
  readonly act = output<LoanActionRequest>();

  protected readonly loan = signal<LibraryLoanResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  private request?: Subscription;

  protected readonly statusClasses = computed(() => {
    const l = this.loan();
    return l ? loanStatusClasses(l.status) : '';
  });
  protected readonly overdueDays = computed(() => {
    const l = this.loan();
    return l ? daysOverdue(l) : 0;
  });
  protected readonly actions = computed(() => {
    const l = this.loan();
    return l
      ? loanActions(l, this.mode()).map((action) => ({ action, label: LOAN_ACTION_LABELS[action] }))
      : [];
  });
  protected readonly facts = computed(() => {
    const l = this.loan();
    if (!l) return [];
    const fee = Number(l.lateFee ?? 0) > 0 ? money(l.lateFee, l.feeCurrency) : '';
    return [
      { label: 'Reserved', value: libraryDate(l.reservedAt) },
      {
        label: 'Pick up by',
        value: l.status === 'RESERVED' ? libraryDate(l.reservationExpiresAt) : '',
      },
      { label: 'Borrowed', value: libraryDate(l.borrowedAt) },
      { label: 'Due', value: libraryDate(l.dueAt) },
      {
        label: 'Renewals',
        value: l.renewalCount ? `${l.renewalCount}, last ${libraryDate(l.lastRenewedAt)}` : '',
      },
      { label: 'Return requested', value: libraryDate(l.returnRequestedAt) },
      { label: 'Returned', value: libraryDate(l.returnedAt) },
      { label: 'Condition when issued', value: l.conditionOnBorrow ?? '' },
      { label: 'Condition when returned', value: l.conditionOnReturn ?? '' },
      {
        label: 'Late fee',
        value: fee ? `${fee}, ${l.feePaid ? `paid ${libraryDate(l.feePaidAt)}` : 'unpaid'}` : '',
      },
      { label: 'Student profile', value: this.mode() === 'staff' ? l.studentId : '' },
      {
        label: 'Due reminder',
        value: l.dueReminderSent ? `Sent ${libraryDate(l.dueReminderSentAt)}` : '',
      },
    ].filter((f) => f.value);
  });

  constructor() {
    effect(() => {
      const id = this.loanId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  show(loan: LibraryLoanResponseDto): void {
    this.loan.set(loan);
  }

  load(id: string = this.loanId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.library
      .getLoan(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loan) => {
          this.loan.set(loan);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loan.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this loan. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected download(loan: LibraryLoanResponseDto): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.library
      .downloadLoanPdf(loan)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not download the PDF.',
          ),
      });
  }
}
