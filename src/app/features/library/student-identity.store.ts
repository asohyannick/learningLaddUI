import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/service/auth/auth.service';

const KEY_PREFIX = 'll.studentProfileId.';

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
    } catch {}
    this.version.update((v) => v + 1);
  }
}
