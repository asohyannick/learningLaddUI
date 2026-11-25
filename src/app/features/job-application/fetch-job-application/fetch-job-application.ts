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
import { Subscription, catchError, finalize, of } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { JobListingService } from '../../job-listing/job-listing.service';
import { JobApplicationResponseDto } from '../job-application.model';
import {
  JobApplicationService,
  applicantInitials,
  applicantName,
  applicationFacts,
  applicationStatusClasses,
  shortDate,
} from '../job-application.service';

@Component({
  selector: 'app-fetch-job-application',
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
        aria-labelledby="application-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="application-panel-title" class="text-base font-semibold text-white">
            Job application
          </h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close job application"
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
          @if (loading() && !application()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading application">
              <div class="h-16 w-16 rounded-full bg-white/10"></div>
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
          } @else if (application(); as a) {
            <div class="flex items-center gap-4">
              @if (a.profilePic && !photoBroken()) {
                <img
                  [src]="a.profilePic"
                  alt=""
                  class="h-16 w-16 rounded-full object-cover"
                  (error)="photoBroken.set(true)"
                />
              } @else {
                <span
                  class="grid h-16 w-16 place-items-center rounded-full bg-indigo-500/20 text-lg font-semibold text-indigo-200"
                  aria-hidden="true"
                  >{{ initials() }}</span
                >
              }
              <div class="min-w-0">
                <h3 class="truncate text-xl font-semibold text-white">{{ name() }}</h3>
                <p class="truncate text-sm text-slate-400">Applied for {{ jobTitle() }}</p>
                <span
                  class="mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                  [class]="statusClasses()"
                  >{{ a.status | enumLabel }}</span
                >
              </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-2 text-sm">
              @if (a.uploadCV) {
                <a
                  [href]="a.uploadCV"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg bg-royal px-3 py-2 font-semibold text-white hover:bg-royal-dark"
                  >Open CV</a
                >
              }
              @if (a.linkedinUrl) {
                <a
                  [href]="a.linkedinUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5"
                  >LinkedIn</a
                >
              }
              @if (a.portfolioUrl) {
                <a
                  [href]="a.portfolioUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5"
                  >Portfolio</a
                >
              }
              <a
                [href]="'mailto:' + a.email"
                class="rounded-lg border border-white/10 px-3 py-2 font-semibold text-slate-200 hover:bg-white/5"
                >Email</a
              >
            </div>

            <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              @for (item of facts(); track item.label) {
                <div class="rounded-lg bg-white/3 px-4 py-3">
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{{ item.label }}</dt>
                  <dd class="mt-0.5 wrap-break-word text-slate-100">{{ item.value }}</dd>
                </div>
              }
            </dl>

            @if (a.supportingDocumentUrls.length) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Supporting documents
                </h4>
                <ul class="mt-2 space-y-1.5 text-sm">
                  @for (url of a.supportingDocumentUrls; track url; let i = $index) {
                    <li>
                      <a
                        [href]="url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-medium text-indigo-300 underline hover:text-indigo-200"
                        >Document {{ i + 1 }}</a
                      >
                    </li>
                  }
                </ul>
              </section>
            }
            @if (a.coverLetter) {
              <section class="mt-6">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Cover letter
                </h4>
                <p class="mt-2 whitespace-pre-line text-sm text-slate-200">{{ a.coverLetter }}</p>
              </section>
            }
            @if (review().length) {
              <section
                class="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm"
              >
                <h4 class="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Review
                </h4>
                @for (item of review(); track item.label) {
                  <p class="mt-2">
                    <span class="text-slate-400">{{ item.label }}:</span> {{ item.value }}
                  </p>
                }
              </section>
            }
            <p class="mt-6 text-xs text-slate-500">
              Links to the CV and documents expire after about an hour; reopen the application for
              fresh ones.
            </p>
            @if (downloadError(); as message) {
              <p class="mt-4 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (application(); as a) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              [disabled]="downloading()"
              (click)="download(a)"
            >
              {{ downloading() ? 'Preparing PDF…' : 'Download PDF' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
              (click)="remove.emit(a)"
            >
              Delete
            </button>
          </footer>
        }
      </aside>
    </div>
  `,
})
export class FetchJobApplication {
  private readonly applications = inject(JobApplicationService);
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly applicationId = input.required<string>();
  readonly closed = output<void>();
  readonly remove = output<JobApplicationResponseDto>();

  protected readonly application = signal<JobApplicationResponseDto | null>(null);
  protected readonly jobTitle = signal('this job');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  protected readonly photoBroken = signal(false);
  private request?: Subscription;

  protected readonly name = computed(() => {
    const a = this.application();
    return a ? applicantName(a) : '';
  });
  protected readonly initials = computed(() => {
    const a = this.application();
    return a ? applicantInitials(a) : '';
  });
  protected readonly facts = computed(() => {
    const a = this.application();
    return a ? applicationFacts(a) : [];
  });
  protected readonly statusClasses = computed(() => {
    const a = this.application();
    return a ? applicationStatusClasses(a.status) : '';
  });
  protected readonly review = computed(() => {
    const a = this.application();
    if (!a) return [];
    return [
      { label: 'Reviewed', value: shortDate(a.reviewedAt) },
      { label: 'Interview', value: shortDate(a.interviewScheduledAt) },
      { label: 'Note', value: a.reviewNote ?? '' },
      { label: 'Reason for rejection', value: a.rejectionReason ?? '' },
      { label: 'Withdrawn', value: shortDate(a.withdrawnAt) },
    ].filter((item) => item.value);
  });

  constructor() {
    effect(() => {
      const id = this.applicationId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.applicationId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.photoBroken.set(false);
    this.request = this.applications
      .getApplication(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (application) => {
          this.application.set(application);
          this.loading.set(false);
          this.loadJobTitle(application.jobListingId);
        },
        error: (error: unknown) => {
          this.application.set(null);
          this.error.set(
            isApiErrorResponse(error)
              ? error.message
              : 'Could not load this application. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  private loadJobTitle(jobId: string): void {
    this.jobs
      .getJobListing(jobId)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((job) =>
        this.jobTitle.set(job ? `${job.title} (${job.referenceCode})` : 'a job that was removed'),
      );
  }

  protected download(application: JobApplicationResponseDto): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.applications
      .downloadApplicationPdf(application)
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
