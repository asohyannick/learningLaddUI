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
import { TimeTableService } from '../time-table.service';

/** Confirms and deletes a timetable entry (`DELETE /time-table/{id}`). */
@Component({
  selector: 'app-delete-time-table',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      heading="Delete this timetable entry?"
      [description]="
        '“' +
        entry().title +
        '” will be removed from the timetable and its creator is told by email. To keep it on record instead, edit it and set the status to Cancelled or Postponed. This cannot be undone.'
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
          {{ deleting() ? 'Deleting…' : 'Delete entry' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeleteTimeTable {
  private readonly timeTables = inject(TimeTableService);
  private readonly destroyRef = inject(DestroyRef);

  readonly entry = input.required<{ id: string; title: string }>();
  /** Emits a message for the toast once deleted. */
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    this.error.set(null);
    this.deleting.set(true);
    this.timeTables
      .deleteTimeTable(this.entry().id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // 204: the API sends no message.
        next: () => this.done.emit(`“${this.entry().title}” was removed from the timetable.`),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not delete the entry. Try again.',
          ),
      });
  }
}
