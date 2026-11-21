import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { isApiErrorResponse } from '../../../interface';
import { AuthLayout } from '../../../../shared/reusable-components/auth-layout/auth-layout';
import { FormAlert } from '../../../../shared/reusable-components/form-alert/form-alert';
import { AuthService } from '../auth.service';

/** Upper bound from `VerifyMagicLinkTokenDto`; anything longer is not a real token. */
const MAX_TOKEN_LENGTH = 255;

/**
 * `/magic-link/verify?token=…`: opened from the emailed link. Exchanges the token for a session
 * straight away and sends the user to their dashboard. The token works once.
 */
@Component({
  selector: 'app-verify-magic-link',
  imports: [AuthLayout, FormAlert, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-magic-link.html',
})
export class VerifyMagicLink implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Query params of the emailed link. `magicLinkToken` is accepted as an alias. */
  readonly token = input<string>();
  readonly magicLinkToken = input<string>();

  private readonly linkToken = computed(() => (this.token() ?? this.magicLinkToken() ?? '').trim());

  protected readonly error = signal<string | null>(null);
  /** The link has no usable token (cut off when copied, or opened by hand). */
  private readonly invalidLink = computed(() => {
    const token = this.linkToken();
    return !token || token.length > MAX_TOKEN_LENGTH;
  });

  /** What went wrong, or null while signing in. */
  protected readonly problem = computed(() => {
    if (this.invalidLink()) {
      return {
        title: 'This link is incomplete',
        subtitle: "We couldn't read the sign-in link.",
        message:
          'The link is missing its token. Open it straight from the email, or ask for a new one.',
      };
    }
    const message = this.error();
    return message
      ? { title: 'Link not valid', subtitle: "This sign-in link can't be used.", message }
      : null;
  });

  ngOnInit(): void {
    if (this.invalidLink()) {
      return;
    }
    this.auth
      .verifyMagicLink(this.linkToken())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // replaceUrl: the spent token must not stay in the history.
        next: () => void this.router.navigateByUrl(this.auth.dashboardPath(), { replaceUrl: true }),
        error: (error: unknown) =>
          this.error.set(
            isApiErrorResponse(error)
              ? error.message
              : 'We could not sign you in with this link. Please try again.',
          ),
      });
  }
}
