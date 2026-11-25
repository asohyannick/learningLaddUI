import { JobPhoto } from '../job-photo/job-photo';
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
import { JobListingResponseDto, JobStatus } from '../job-listing.model';
import {
  JobListingService,
  jobDateLabel,
  jobFacts,
  jobStatusClasses,
} from '../job-listing.service';

@Component({
  selector: 'app-fetch-job-listing',
  imports: [JobPhoto, EnumLabelPipe],
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
        aria-labelledby="job-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="job-panel-title" class="text-base font-semibold text-white">Job listing</h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close job listing"
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
          @if (loading() && !listing()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading listing">
              <div class="h-32 rounded-xl bg-white/5"></div>
              <div class="h-6 w-2/3 rounded bg-white/10"></div>
              @for (row of [1, 2, 3, 4]; track row) {
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
          } @else if (listing(); as job) {
            @if (job.jobPhotoUrl) {
              <app-job-photo
                tone="dark"
                [src]="job.jobPhotoUrl"
                class="mb-5 h-40 w-full rounded-xl"
              />
            }
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                [class]="statusClasses()"
                >{{ job.status | enumLabel }}</span
              >
              <span class="rounded-md bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300">{{
                job.referenceCode
              }}</span>
            </div>
            <h3 class="mt-3 text-xl font-semibold text-white">{{ job.title }}</h3>
            @if (job.shortDescription) {
              <p class="mt-1 text-sm text-slate-400">{{ job.shortDescription }}</p>
            }

            <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              @for (item of facts(); track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
              @if (job.contactEmail) {
                <div class="rounded-lg bg-white/3 px-4 py-3 sm:col-span-2">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">Contact</dt>
                  <dd class="mt-0.5 break-all">
                    <a
                      [href]="'mailto:' + job.contactEmail"
                      class="font-medium text-indigo-300 underline hover:text-indigo-200"
                      >{{ job.contactEmail }}</a
                    >
                  </dd>
                </div>
              }
            </dl>

            @for (section of sections(); track section.title) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {{ section.title }}
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ section.text }}</p>
              </section>
            }
            @for (list of lists(); track list.title) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {{ list.title }}
                </h4>
                <ul class="mt-2 flex flex-wrap gap-1.5">
                  @for (item of list.items; track item) {
                    <li class="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-200">
                      {{ item }}
                    </li>
                  }
                </ul>
              </section>
            }

            <p class="mt-6 text-xs text-slate-500">{{ history() }}</p>
            @if (actionError(); as message) {
              <p class="mt-4 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (listing(); as job) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            @if (canPublish()) {
              <button
                type="button"
                class="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                [disabled]="busy() !== null"
                (click)="publish(job)"
              >
                {{ busy() === 'publish' ? 'Publishing…' : 'Publish: open for applications' }}
              </button>
            }
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              [disabled]="busy() !== null"
              (click)="download(job)"
            >
              {{ busy() === 'pdf' ? 'Preparing PDF…' : 'Download PDF' }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
              (click)="edit.emit(job)"
            >
              Edit listing
            </button>
            <button
              type="button"
              class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
              (click)="remove.emit(job)"
            >
              Delete
            </button>
          </footer>
        }
      </aside>
    </div>
  `,
})
export class FetchJobListing {
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly jobListingId = input.required<string>();
  readonly closed = output<void>();
  readonly edit = output<JobListingResponseDto>();
  readonly remove = output<JobListingResponseDto>();
  readonly changed = output<string>();

  protected readonly listing = signal<JobListingResponseDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<'pdf' | 'publish' | null>(null);
  protected readonly actionError = signal<string | null>(null);
  private request?: Subscription;

  protected readonly facts = computed(() => {
    const job = this.listing();
    return job ? jobFacts(job) : [];
  });
  protected readonly statusClasses = computed(() =>
    jobStatusClasses(this.listing()?.status ?? JobStatus.DRAFT),
  );
  protected readonly canPublish = computed(() => {
    const status = this.listing()?.status;
    return status === JobStatus.DRAFT || status === JobStatus.ON_HOLD;
  });
  protected readonly sections = computed(() => {
    const job = this.listing();
    if (!job) return [];
    return [
      { title: 'Description', text: job.description },
      { title: 'Responsibilities', text: job.responsibilities },
      { title: 'Requirements', text: job.requirements },
      { title: 'How to apply', text: job.applicationInstructions },
    ].filter((s): s is { title: string; text: string } => !!s.text);
  });
  protected readonly lists = computed(() => {
    const job = this.listing();
    if (!job) return [];
    return [
      { title: 'Skills', items: job.skills ?? [] },
      { title: 'Certifications', items: job.certifications ?? [] },
      { title: 'Languages', items: job.languages ?? [] },
      { title: 'Benefits', items: job.benefits ?? [] },
    ].filter((list) => list.items.length);
  });
  protected readonly history = computed(() => {
    const job = this.listing();
    if (!job) return '';
    return [
      `Created ${jobDateLabel(job.createdAt)}`,
      job.publishedAt ? `published ${jobDateLabel(job.publishedAt)}` : 'not published yet',
      job.closedAt ? `closed ${jobDateLabel(job.closedAt)}` : '',
      `updated ${jobDateLabel(job.updatedAt)}`,
    ]
      .filter(Boolean)
      .join(', ');
  });

  constructor() {
    effect(() => {
      const id = this.jobListingId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.jobListingId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.jobs
      .getJobListing(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (listing) => {
          this.listing.set(listing);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.listing.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this listing. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected publish(job: JobListingResponseDto): void {
    this.run('publish', () =>
      this.jobs.updateJobListing(job.id, { status: JobStatus.OPEN }).subscribe({
        next: (res) => {
          this.listing.set(res.data);
          this.changed.emit(`“${job.title}” is now open for applications.`);
        },
        error: (error: unknown) => this.fail(error, 'Could not publish the listing. Try again.'),
      }),
    );
  }

  protected download(job: JobListingResponseDto): void {
    this.run('pdf', () =>
      this.jobs.downloadJobListingPdf(job).subscribe({
        error: (error: unknown) => this.fail(error, 'Could not download the PDF. Try again.'),
      }),
    );
  }

  private run(kind: 'pdf' | 'publish', start: () => Subscription): void {
    this.actionError.set(null);
    this.busy.set(kind);
    const sub = start();
    sub.add(() => this.busy.set(null));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private fail(error: unknown, fallback: string): void {
    this.actionError.set(isApiErrorResponse(error) ? error.message : fallback);
  }
}
