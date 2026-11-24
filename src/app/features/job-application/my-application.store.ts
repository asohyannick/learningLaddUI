import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/service/auth/auth.service';

const KEY_PREFIX = 'll.jobApplicationId.';

/**
 * Remembers the signed-in user's job application ID in this browser. The API has no
 * "my applications" endpoint and allows one application per person, so the ID from the submit
 * response is how the applicant finds their application again.
 */
@Injectable({ providedIn: 'root' })
export class MyApplicationStore {
  private readonly user = inject(AuthService).user;
  /** Bumped on every write so `applicationId` recomputes. */
  private readonly version = signal(0);

  readonly applicationId = computed(() => {
    this.version();
    const userId = this.user()?.id;
    if (!userId) return null;
    try {
      return localStorage.getItem(KEY_PREFIX + userId);
    } catch {
      return null;
    }
  });

  remember(applicationId: string): void {
    this.write((key) => localStorage.setItem(key, applicationId));
  }

  forget(): void {
    this.write((key) => localStorage.removeItem(key));
  }

  private write(action: (key: string) => void): void {
    const userId = this.user()?.id;
    if (!userId) return;
    try {
      action(KEY_PREFIX + userId);
    } catch {
      // Storage blocked (private mode): the page still works for this visit.
    }
    this.version.update((v) => v + 1);
  }
}
