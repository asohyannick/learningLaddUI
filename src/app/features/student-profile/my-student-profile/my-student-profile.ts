import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { AuthService } from '../../../core/service/auth/auth.service';
import { DeleteStudentProfile } from '../delete-student-profile/delete-student-profile';
import { StudentProfileDetails } from '../student-profile-details/student-profile-details';
import {
  StudentProfileForm,
  StudentProfileSaved,
} from '../student-profile-form/student-profile-form';
import { StudentProfileResponse } from '../student-profile.model';
import { fullName } from '../student-profile.service';

const STORAGE_PREFIX = 'll.studentProfileId.';

type Dialog = 'create' | 'edit' | 'delete';

@Component({
  selector: 'app-my-student-profile',
  imports: [DeleteStudentProfile, NgTemplateOutlet, StudentProfileDetails, StudentProfileForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-2xl border border-white/10 bg-navy-900 p-6 text-slate-200">
      @if (profile(); as p) {
        <app-student-profile-details [profile]="p" />
        <div class="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      } @else if (profileId()) {
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold text-white">Your student profile is saved</h2>
            <p class="mt-1 max-w-xl text-sm text-slate-400">
              You can update or delete it here. Only staff such as the registrar can view the full
              profile and export it as PDF.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <ng-container *ngTemplateOutlet="actions" />
          </div>
        </div>
      } @else {
        <div class="mx-auto max-w-lg py-6 text-center">
          <span
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-royal/20 text-indigo-200"
            aria-hidden="true"
          >
            <svg class="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.47 15.15a1.5 1.5 0 0 0 .68 1.9A11.94 11.94 0 0 0 10 18.5c2.1 0 4.08-.54 5.85-1.45a1.5 1.5 0 0 0 .68-1.9A7 7 0 0 0 3.47 15.15Z"
              />
            </svg>
          </span>
          <h2 class="mt-4 text-lg font-semibold text-white">Set up your student profile</h2>
          <p class="mt-1 text-sm text-slate-400">
            Add your details, studies and an emergency contact so the school can reach you. Only
            your name is required.
          </p>
          <button
            type="button"
            class="mt-5 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-royal/20 hover:bg-royal-dark"
            (click)="dialog.set('create')"
          >
            Create my profile
          </button>
        </div>
      }
    </section>

    <ng-template #actions>
      <button
        type="button"
        class="rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
        (click)="dialog.set('edit')"
      >
        Edit my profile
      </button>
      <button
        type="button"
        class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
        (click)="dialog.set('delete')"
      >
        Delete my profile
      </button>
    </ng-template>

    @switch (dialog()) {
      @case ('create') {
        <app-student-profile-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      }
      @case ('edit') {
        <app-student-profile-form
          [profileId]="profileId()"
          [initial]="profile()"
          [canLoad]="false"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      }
      @case ('delete') {
        <app-delete-student-profile
          [profile]="{ id: profileId()!, name: name() }"
          [own]="true"
          (done)="onDeleted($event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class MyStudentProfile {
  private readonly auth = inject(AuthService);

  readonly notify = output<string>();

  private readonly storageKey = computed(() => {
    const id = this.auth.user()?.id;
    return id ? STORAGE_PREFIX + id : null;
  });

  protected readonly profile = signal<StudentProfileResponse | null>(null);
  protected readonly profileId = signal<string | null>(this.readStoredId());
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly name = computed(() => {
    const p = this.profile();
    return p ? fullName(p) : 'your profile';
  });

  protected onSaved(saved: StudentProfileSaved): void {
    this.dialog.set(null);
    this.profile.set(saved.profile);
    this.remember(saved.profile.id);
    this.notify.emit(saved.message);
  }

  protected onDeleted(message: string): void {
    this.dialog.set(null);
    this.profile.set(null);
    this.remember(null);
    this.notify.emit(message);
  }

  private remember(id: string | null): void {
    this.profileId.set(id);
    const key = this.storageKey();
    if (!key) return;
    try {
      if (id) localStorage.setItem(key, id);
      else localStorage.removeItem(key);
    } catch {}
  }

  private readStoredId(): string | null {
    const id = inject(AuthService).user()?.id;
    if (!id) return null;
    try {
      return localStorage.getItem(STORAGE_PREFIX + id);
    } catch {
      return null;
    }
  }
}
