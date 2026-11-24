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
import { JobApplicationService } from '../job-application.service';

/** Confirms and deletes a job application (`DELETE /job-application/{id}`). */
@Component({
  selector: 'app-delete-job-application',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      heading="Delete this application?"
      [description]="
        'The application from ' +
        application().name +
        ' and its photo will be removed for good. This cannot be undone.'
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
          {{ deleting() ? 'Deleting…' : 'Delete application' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeleteJobApplication {
  private readonly applications = inject(JobApplicationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly application = input.required<{ id: string; name: string }>();
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    this.error.set(null);
    this.deleting.set(true);
    this.applications
      .deleteApplication(this.application().id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.done.emit(`The application from ${this.application().name} was deleted.`),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error)
              ? error.message
              : 'Could not delete the application. Try again.',
          ),
      });
  }
}
