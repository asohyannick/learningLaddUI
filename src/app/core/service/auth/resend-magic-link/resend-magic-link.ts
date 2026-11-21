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
import { isApiErrorResponse } from '../../../interface';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { createCountdown } from '../../../../shared/utils/countdown';
import { AuthService } from '../auth.service';

/** The API allows one new link per minute. */
export const MAGIC_LINK_COOLDOWN_SECONDS = 60;

/**
 * "Send another link" button with the 60-second cooldown. Starts counting down straight away,
 * because it is shown right after a link was sent. The previous link stops working.
 */
@Component({
  selector: 'app-resend-magic-link',
  imports: [FormAlert],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resend-magic-link.html',
})
export class ResendMagicLink {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = input.required<string>();
  /** Emits the API message after a new link is sent. */
  readonly resent = output<string>();

  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly cooldown = createCountdown(this.destroyRef);

  constructor() {
    this.cooldown.start(MAGIC_LINK_COOLDOWN_SECONDS);
  }

  protected resend(): void {
    this.error.set(null);
    this.sending.set(true);
    this.auth
      .resendMagicLink({ email: this.email() })
      .pipe(
        finalize(() => this.sending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (message) => {
          this.cooldown.start(MAGIC_LINK_COOLDOWN_SECONDS);
          this.resent.emit(message || 'A new sign-in link is on its way.');
        },
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not send a new link. Try again.',
          ),
      });
  }
}
