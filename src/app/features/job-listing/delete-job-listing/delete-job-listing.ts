import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { FormAlert } from '../../../shared/reusable-components/form-alert/form-alert';
import { Modal } from '../../../shared/reusable-components/modal/modal';
import { JobListingService } from '../job-listing.service';

/** Confirms and deletes a job listing (`DELETE /job-listing/{id}`). */
@Component({
  selector: 'app-delete-job-listing',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      heading="Delete this job listing?"
      [description]="
        '“' +
        listing().title +
        '” and its photo will be removed for good. To stop applications but keep it on record, edit it and set the status to Closed or Cancelled instead. This cannot be undone.'
      "
      tone="danger"
      [busy]="deleting()"
      (closed)="cancelled.emit()"
    >
      @if (error(); as message) {
        <app-form-alert class="mb-4">{{ message }}</app-form-alert>
      }
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-60"
          [disabled]="deleting()"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          [disabled]="deleting()"
          (click)="confirm()"
        >
          {{ deleting() ? 'Deleting…' : 'Delete listing' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeleteJobListing {
  private readonly jobs = inject(JobListingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly listing = input.required<{ id: string; title: string }>();
  /** Emits a message for the toast once deleted. */
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    this.error.set(null);
    this.deleting.set(true);
    this.jobs
      .deleteJobListing(this.listing().id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.done.emit(`“${this.listing().title}” was deleted.`),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not delete the listing. Try again.',
          ),
      });
  }
}
