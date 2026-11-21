import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Split layout for the sign-in and sign-up pages: brand panel on the left, form on the right. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth-layout.html',
})
export class AuthLayout {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();

  protected readonly year = new Date().getFullYear();
}
