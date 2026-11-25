import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/service/auth/auth.service';

/** Same key the "My profile" page uses for the student profile ID. */
const KEY_PREFIX = 'll.studentProfileId.';

/**
 * The signed-in student's profile ID, which loans use as `studentId`. Students cannot read their
 * own profile from the API, so it comes from this browser: saved by "My profile" when the
 * profile is created, or from the first reservation made here.
 */
@Injectable({ providedIn: 'root' })
export class StudentIdentityStore {
  private readonly user = inject(AuthService).user;
  private readonly version = signal(0);

  readonly studentProfileId = computed(() => {
    this.version();
    const userId = this.user()?.id;
    if (!userId) return null;
    try {
      return localStorage.getItem(KEY_PREFIX + userId);
    } catch {
      return null;
    }
  });

  remember(studentProfileId: string): void {
    const userId = this.user()?.id;
    if (!userId || this.studentProfileId() === studentProfileId) return;
    try {
      localStorage.setItem(KEY_PREFIX + userId, studentProfileId);
    } catch {
      // Storage blocked: only this visit knows it.
    }
    this.version.update((v) => v + 1);
  }
}
