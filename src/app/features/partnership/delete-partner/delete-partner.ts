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
import { PartnershipService } from '../partnership.service';

/** Confirms and deletes a partner (`DELETE /partners/{id}`). Staff only. */
@Component({
  selector: 'app-delete-partner',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      heading="Delete this partner?"
      [description]="
        partner().name +
        ' and its logo and banner will be removed from the website and the records. The signed agreement file is kept. To keep the history instead, set the status to Inactive. This cannot be undone.'
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
          {{ deleting() ? 'Deleting…' : 'Delete partner' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeletePartner {
  private readonly partners = inject(PartnershipService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partner = input.required<{ id: string; name: string }>();
  /** Emits the API message once deleted. */
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    this.error.set(null);
    this.deleting.set(true);
    this.partners
      .deletePartner(this.partner().id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => this.done.emit(message),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not delete the partner. Try again.',
          ),
      });
  }
}
