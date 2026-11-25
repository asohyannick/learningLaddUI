import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
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
import { PartnerDetails } from '../partner-details/partner-details';
import { PartnersResponseDto } from '../partnership.model';
import { PartnershipService } from '../partnership.service';

@Component({
  selector: 'app-fetch-partner',
  imports: [PartnerDetails],
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
        aria-labelledby="partner-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="partner-panel-title" class="text-base font-semibold text-white">Partner</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close partner"
            (click)="closed.emit()"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
              />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          @if (loading() && !partner()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading partner">
              <div class="flex items-center gap-4">
                <div class="h-20 w-20 rounded-full bg-white/10"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-5 w-2/3 rounded bg-white/10"></div>
                  <div class="h-3 w-1/2 rounded bg-white/10"></div>
                </div>
              </div>
              @for (row of [1, 2, 3, 4, 5]; track row) {
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
          } @else if (partner(); as p) {
            <app-partner-details [partner]="p" />
            @if (downloadError(); as message) {
              <p class="mt-6 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (partner(); as p) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              [disabled]="downloading()"
              (click)="download(p)"
            >
              {{ downloading() ? 'Preparing PDF…' : 'Download PDF' }}
            </button>
            @if (canManage()) {
              <button
                type="button"
                class="flex-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
                (click)="edit.emit(p)"
              >
                Edit partner
              </button>
              <button
                type="button"
                class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
                (click)="remove.emit(p)"
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
export class FetchPartner {
  private readonly partners = inject(PartnershipService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly partnerId = input.required<string>();
  readonly canManage = input(false);
  readonly closed = output<void>();
  readonly edit = output<PartnersResponseDto>();
  readonly remove = output<PartnersResponseDto>();

  protected readonly partner = signal<PartnersResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  private request?: Subscription;

  constructor() {
    effect(() => {
      const id = this.partnerId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.partnerId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.partners
      .getPartner(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.partner.set(res.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.partner.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this partner. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected download(partner: PartnersResponseDto): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.partners
      .downloadPartnerPdf(partner)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not download the PDF. Try again.',
          ),
      });
  }
}
