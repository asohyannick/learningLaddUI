import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logout.html',
})
export class Logout {
  constructor() {
    const router = inject(Router);
    inject(AuthService)
      .logout()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        complete: () =>
          void router.navigate(['/login'], {
            queryParams: { signedOut: 'true' },
            replaceUrl: true,
          }),
      });
  }
}
