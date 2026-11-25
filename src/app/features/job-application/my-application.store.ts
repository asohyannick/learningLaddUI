import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/service/auth/auth.service';

const KEY_PREFIX = 'll.jobApplicationId.';

@Injectable({ providedIn: 'root' })
export class MyApplicationStore {
  private readonly user = inject(AuthService).user;
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
    } catch {}
    this.version.update((v) => v + 1);
  }
}
