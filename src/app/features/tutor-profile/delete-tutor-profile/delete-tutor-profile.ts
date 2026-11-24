import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
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
import { TutorProfileService } from '../tutor-profile.service';

/** Confirms and deletes a tutor profile (`DELETE /tutor-profile/{id}`): owner or admin. */
@Component({
  selector: 'app-delete-tutor-profile',
  imports: [FormAlert, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal
      [heading]="own() ? 'Delete your tutor profile?' : 'Delete this tutor profile?'"
      [description]="description()"
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
          {{ deleting() ? 'Deleting…' : 'Delete profile' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DeleteTutorProfile {
  private readonly profiles = inject(TutorProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input.required<{ id: string; name: string }>();
  /** The signed-in tutor is deleting their own profile. */
  readonly own = input(false);
  /** Emits the API message once deleted. */
  readonly done = output<string>();
  readonly cancelled = output<void>();

  protected readonly deleting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly description = computed(() =>
    this.own()
      ? 'Your details, subjects, rate and picture will be removed, and students will no longer find you. Your account and courses stay. This cannot be undone.'
      : `The profile of ${this.profile().name} and its picture will be removed. Their account stays. This cannot be undone.`,
  );

  protected confirm(): void {
    this.error.set(null);
    this.deleting.set(true);
    this.profiles
      .deleteProfile(this.profile().id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => this.done.emit(message),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not delete the profile. Try again.',
          ),
      });
  }
}
