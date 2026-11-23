import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered dialog over a dimmed backdrop. Render it with `@if`; it emits `closed` on Escape,
 * a backdrop click or the × button. Focus moves inside on open, stays inside while open
 * (Tab wraps), and returns to the element that opened it.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div class="absolute inset-0 bg-navy-950/70 backdrop-blur-sm" (click)="close()"></div>
      <section
        class="relative max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-6 text-ink shadow-2xl"
        [class.max-w-md]="size() === 'md'"
        [class.max-w-3xl]="size() === 'lg'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
      >
        <div class="mb-5 flex items-start gap-4">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            [class]="tone() === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-royal-soft text-royal'"
            aria-hidden="true"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M8.49 2.86c.67-1.15 2.35-1.15 3.02 0l6.28 10.88c.67 1.15-.17 2.6-1.51 2.6H3.72c-1.34 0-2.18-1.45-1.51-2.6L8.49 2.86ZM10 7a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 7Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <h2 [id]="titleId" class="text-lg font-semibold">{{ heading() }}</h2>
            @if (description(); as text) {
              <p class="mt-1 text-sm text-muted">{{ text }}</p>
            }
          </div>
          <button
            type="button"
            class="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-ink"
            aria-label="Close"
            (click)="close()"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
              />
            </svg>
          </button>
        </div>
        <ng-content />
      </section>
    </div>
  `,
})
export class Modal {
  private static nextId = 0;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly opener =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly tone = input<'default' | 'danger'>('default');
  /** `lg` for long forms; the dialog scrolls when taller than the screen. */
  readonly size = input<'md' | 'lg'>('md');
  /** Set while a request runs so the dialog cannot be dismissed half-way. */
  readonly busy = input(false);
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${Modal.nextId++}`;

  constructor() {
    afterNextRender(() => {
      const panel = this.host.nativeElement.querySelector('section');
      const target =
        panel?.querySelector<HTMLElement>('input, textarea, select') ??
        panel?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });
  }

  ngOnDestroy(): void {
    this.opener?.focus?.();
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(`section ${FOCUSABLE}`),
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
