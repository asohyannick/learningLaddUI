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
import { LibraryBookResponseDto, isAvailableToBorrow } from '../library.model';
import { LibraryService, libraryDate, money } from '../library.service';

/** Side panel: one book (`GET /library/books/{id}`), with Borrow, Edit and Delete. */
@Component({
  selector: 'app-fetch-book',
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
        aria-labelledby="book-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="book-panel-title" class="text-base font-semibold text-white">Book</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close book"
            (click)="closed.emit()"
          >
            ✕
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          @if (loading() && !book()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading book">
              <div class="h-32 w-24 rounded bg-white/10"></div>
              <div class="h-6 w-2/3 rounded bg-white/10"></div>
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
          } @else if (book(); as b) {
            <div class="flex gap-4">
              @if (b.coverImage && !coverBroken()) {
                <img
                  [src]="b.coverImage"
                  alt=""
                  class="h-36 w-24 shrink-0 rounded object-cover"
                  (error)="coverBroken.set(true)"
                />
              }
              <div class="min-w-0">
                <h3 class="text-xl font-semibold text-white">{{ b.title }}</h3>
                @if (b.subtitle) {
                  <p class="text-sm text-slate-300">{{ b.subtitle }}</p>
                }
                <p class="mt-1 text-sm text-slate-400">by {{ b.author }}</p>
                <p
                  class="mt-3 text-sm font-semibold"
                  [class]="available() ? 'text-emerald-300' : 'text-amber-300'"
                >
                  {{ availability() }}
                </p>
              </div>
            </div>

            <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              @for (item of facts(); track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
            </dl>
            @if (b.description) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  About this book
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ b.description }}</p>
              </section>
            }
          }
        </div>

        @if (book(); as b) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            @if (canBorrow() && available()) {
              <button
                type="button"
                class="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                (click)="borrow.emit(b)"
              >
                Borrow this book
              </button>
            }
            @if (canManage()) {
              <button
                type="button"
                class="flex-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
                (click)="edit.emit(b)"
              >
                Edit book
              </button>
              <button
                type="button"
                class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
                (click)="remove.emit(b)"
              >
                Delete
              </button>
            }
          </footer>
        }
      </aside>
    </div>
  `,
})
export class FetchBook {
  private readonly library = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly bookId = input.required<string>();
  readonly canManage = input(false);
  readonly canBorrow = input(false);
  readonly closed = output<void>();
  readonly edit = output<LibraryBookResponseDto>();
  readonly remove = output<LibraryBookResponseDto>();
  readonly borrow = output<LibraryBookResponseDto>();

  protected readonly book = signal<LibraryBookResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly coverBroken = signal(false);
  private request?: Subscription;

  protected readonly available = computed(() => {
    const b = this.book();
    return !!b && isAvailableToBorrow(b);
  });
  protected readonly availability = computed(() => {
    const b = this.book();
    if (!b) return '';
    if (!b.active) return 'Withdrawn from the catalog';
    if (!b.borrowable) return 'Reference only: read it in the library';
    return b.availableCopies > 0
      ? `${b.availableCopies} of ${b.totalCopies} copies available`
      : `All ${b.totalCopies} copies are out`;
  });
  protected readonly facts = computed(() => {
    const b = this.book();
    if (!b) return [];
    return [
      { label: 'ISBN', value: b.isbn ?? '' },
      { label: 'Publisher', value: [b.publisher, b.publicationYear].filter(Boolean).join(', ') },
      { label: 'Edition', value: b.edition ?? '' },
      { label: 'Language', value: b.language ?? '' },
      { label: 'Category', value: b.category ?? '' },
      { label: 'Pages', value: b.pageCount ? String(b.pageCount) : '' },
      { label: 'Shelf', value: b.shelfLocation ?? '' },
      {
        label: 'Loan period',
        value: `${b.loanPeriodDays} days, ${b.maxRenewals} renewal${b.maxRenewals === 1 ? '' : 's'}`,
      },
      {
        label: 'Late fee',
        value: Number(b.dailyLateFee) > 0 ? `${money(b.dailyLateFee, b.currency)} per day` : 'None',
      },
      { label: 'Added', value: libraryDate(b.createdAt) },
    ].filter((f) => f.value);
  });

  constructor() {
    effect(() => {
      const id = this.bookId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.bookId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.library
      .getBook(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (book) => {
          this.book.set(book);
          this.coverBroken.set(false);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.book.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this book. Try again.',
          );
          this.loading.set(false);
        },
      });
  }
}
