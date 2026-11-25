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
import { TimeTableResponseDto } from '../time-table.model';
import {
  TimeTableService,
  dateLabel,
  durationLabel,
  scheduleLabel,
  sessionModeClasses,
  timeRange,
  timeTableStatusClasses,
} from '../time-table.service';

@Component({
  selector: 'app-fetch-time-table',
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
        aria-labelledby="timetable-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="timetable-panel-title" class="text-base font-semibold text-white">
            Timetable entry
          </h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close timetable entry"
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
          @if (loading() && !entry()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading entry">
              <div class="h-6 w-2/3 rounded bg-white/10"></div>
              <div class="h-3 w-1/2 rounded bg-white/10"></div>
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
          } @else if (entry(); as t) {
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                [class]="view().statusClasses"
                >{{ t.status | enumLabel }}</span
              >
              <span
                class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
                [class]="view().modeClasses"
                >{{ t.sessionMode | enumLabel }}</span
              >
              @if (t.recurring) {
                <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300"
                  >Weekly</span
                >
              }
            </div>
            <h3 class="mt-3 text-xl font-semibold text-white">{{ t.title }}</h3>
            <p class="mt-1 text-sm text-slate-400">{{ t.courseName }}</p>

            <dl class="mt-6 grid gap-3 text-sm">
              @for (item of view().facts; track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
              @if (t.meetingUrl) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">Meeting link</dt>
                  <dd class="mt-0.5 break-all">
                    <a
                      [href]="t.meetingUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-medium text-indigo-300 underline hover:text-indigo-200"
                      >{{ t.meetingUrl }}</a
                    >
                  </dd>
                </div>
              }
            </dl>

            @if (t.description) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  About this session
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ t.description }}</p>
              </section>
            }
            @if (t.notes) {
              <section class="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Notes for learners
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ t.notes }}</p>
              </section>
            }
            @if (downloadError(); as message) {
              <p class="mt-6 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (entry(); as t) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              [disabled]="downloading()"
              (click)="download(t)"
            >
              {{ downloading() ? 'Preparing PDF…' : 'Download PDF' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
              (click)="edit.emit(t)"
            >
              Edit entry
            </button>
            @if (canDelete()) {
              <button
                type="button"
                class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
                (click)="remove.emit(t)"
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
export class FetchTimeTable {
  private readonly timeTables = inject(TimeTableService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly timeTableId = input.required<string>();
  readonly canDelete = input(false);
  readonly closed = output<void>();
  readonly edit = output<TimeTableResponseDto>();
  readonly remove = output<TimeTableResponseDto>();

  protected readonly entry = signal<TimeTableResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  private request?: Subscription;

  protected readonly view = computed(() => {
    const t = this.entry();
    if (!t) return { facts: [], statusClasses: '', modeClasses: '' };
    const duration = durationLabel(t.durationMinutes);
    const facts = [
      { label: t.recurring ? 'Repeats' : 'Date', value: scheduleLabel(t) },
      {
        label: 'Time',
        value: `${timeRange(t)}${duration ? ` (${duration})` : ''} · ${t.timezone}`,
      },
      ...(t.location ? [{ label: 'Location', value: t.location }] : []),
      { label: 'Capacity', value: t.capacity ? `${t.capacity} learners` : 'Unlimited' },
      ...(t.updatedAt
        ? [{ label: 'Last updated', value: dateLabel(t.updatedAt.slice(0, 10)) }]
        : []),
    ];
    return {
      facts,
      statusClasses: timeTableStatusClasses(t.status),
      modeClasses: sessionModeClasses(t.sessionMode),
    };
  });

  constructor() {
    effect(() => {
      const id = this.timeTableId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.timeTableId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.timeTables
      .getTimeTable(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => {
          this.entry.set(entry);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.entry.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this entry. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected download(entry: TimeTableResponseDto): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.timeTables
      .downloadTimeTablePdf(entry)
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
