import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { inputClasses } from '../../../shared/validators/field-styles';
import { JobListingResponseDto } from '../../job-listing/job-listing.model';
import { JobListingService } from '../../job-listing/job-listing.service';
import { ApplyForm } from '../apply-form/apply-form';
import { JobApplicationResponseDto } from '../job-application.model';

/**
 * Submit an application from the dashboard (`POST /job-application`): pick an open job, then
 * fill in the same form applicants use on the job page. The API records the application under
 * the signed-in account and allows one application per account.
 */
@Component({
  selector: 'app-submit-job-application',
  imports: [ApplyForm, FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (job(); as j) {
      <app-apply-form [job]="j" (done)="done.emit($event)" (cancelled)="cancelled.emit()" />
    } @else {
      <app-modal
        heading="Submit a job application"
        description="Choose the open job to apply for. The application is saved under your own account, and the API allows one application per account."
        [busy]="loadingJob()"
        (closed)="cancelled.emit()"
      >
        @if (error(); as message) {
          <app-form-alert class="mb-4">{{ message }}</app-form-alert>
        }
        <label for="sa-job" class="mb-1.5 block text-sm font-medium">Job</label>
        @if (openJobs.isLoading()) {
          <div class="h-11 animate-pulse rounded-lg bg-slate-100" role="status"></div>
        } @else if (openJobs.hasValue() && openJobs.value().content.length) {
          <select
            id="sa-job"
            [class]="inputClasses(false)"
            [value]="jobId()"
            (change)="jobId.set($any($event.target).value)"
          >
            <option value="">Choose a job</option>
            @for (j of openJobs.value().content; track j.id) {
              <option [value]="j.id">{{ j.title }} ({{ j.referenceCode }})</option>
            }
          </select>
        } @else {
          <p class="rounded-lg bg-cream p-3 text-sm text-muted">
            There are no open jobs taking applications. Publish a job listing first (Job listings →
            View → Publish).
          </p>
        }
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark disabled:opacity-60"
            [disabled]="!jobId() || loadingJob()"
            (click)="continue()"
          >
            {{ loadingJob() ? 'Loading…' : 'Continue' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class SubmitJobApplication {
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly done = output<JobApplicationResponseDto>();
  readonly cancelled = output<void>();

  protected readonly inputClasses = inputClasses;

  /** Jobs still taking applications (OPEN, before the deadline), by title. */
  protected readonly openJobs = rxResource({
    stream: () =>
      this.jobs.searchOpenJobListings({
        page: 0,
        size: 100,
        sortBy: 'title',
        sortDirection: 'asc',
      }),
  });

  protected readonly jobId = signal('');
  protected readonly job = signal<JobListingResponseDto | null>(null);
  protected readonly loadingJob = signal(false);
  protected readonly error = signal<string | null>(null);

  protected continue(): void {
    this.error.set(null);
    this.loadingJob.set(true);
    this.jobs
      .getJobListing(this.jobId())
      .pipe(
        finalize(() => this.loadingJob.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => this.job.set(job),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this job. Try again.',
          ),
      });
  }
}
