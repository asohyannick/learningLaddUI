import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map, of, switchMap } from 'rxjs';
import { TUTOR_PROFILE_READ_ROLES } from '../../../core/enum/global-enum-configuration';
import { isApiErrorResponse } from '../../../core/interface';
import { AuthService } from '../../../core/service/auth/auth.service';
import { DeleteTutorProfile } from '../delete-tutor-profile/delete-tutor-profile';
import { TutorProfileDetails } from '../tutor-profile-details/tutor-profile-details';
import { TutorProfileForm, TutorProfileSaved } from '../tutor-profile-form/tutor-profile-form';
import { TutorProfileResponse } from '../tutor-profile.model';
import { TutorProfileService, tutorName } from '../tutor-profile.service';

const STORAGE_PREFIX = 'll.tutorProfileId.';

type Dialog = 'create' | 'edit' | 'delete';

@Component({
  selector: 'app-my-tutor-profile',
  imports: [DeleteTutorProfile, NgTemplateOutlet, TutorProfileDetails, TutorProfileForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-2xl border border-white/10 bg-navy-900 p-6 text-slate-200">
      @if (loading()) {
        <div class="animate-pulse space-y-4" role="status" aria-label="Loading your profile">
          <div class="flex items-center gap-4">
            <div class="h-20 w-20 rounded-full bg-white/10"></div>
            <div class="flex-1 space-y-2">
              <div class="h-5 w-1/2 rounded bg-white/10"></div>
              <div class="h-3 w-1/3 rounded bg-white/10"></div>
            </div>
          </div>
          <div class="h-10 rounded-lg bg-white/5"></div>
        </div>
      } @else if (profile(); as p) {
        <app-tutor-profile-details [profile]="p" />
        <div class="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      } @else if (profileId()) {
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold text-white">Your tutor profile is saved</h2>
            <p class="mt-1 max-w-xl text-sm text-slate-400">
              You can update or delete it here. Students and staff see the full profile in the tutor
              directory, and staff can export it as PDF.
            </p>
            @if (loadError(); as message) {
              <p class="mt-2 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          </div>
          <div class="flex flex-wrap gap-2">
            <ng-container *ngTemplateOutlet="actions" />
          </div>
        </div>
      } @else {
        <div class="mx-auto max-w-lg py-6 text-center">
          <span
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200"
            aria-hidden="true"
          >
            <svg class="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M10.5 1.66a1 1 0 0 0-1 0L1.8 6.1a.75.75 0 0 0 0 1.3l7.7 4.44a1 1 0 0 0 1 0L17 8.1v4.65a.75.75 0 0 0 1.5 0V7a.75.75 0 0 0-.3-.6l-7.7-4.74ZM4.5 10.4v2.85c0 .27.14.52.37.65l4.63 2.67a1 1 0 0 0 1 0l4.63-2.67a.75.75 0 0 0 .37-.65V10.4l-4.5 2.6a2 2 0 0 1-2 0L4.5 10.4Z"
              />
            </svg>
          </span>
          <h2 class="mt-4 text-lg font-semibold text-white">Set up your tutor profile</h2>
          <p class="mt-1 text-sm text-slate-400">
            Tell students what you teach, your experience and your hourly rate so they can find and
            book you. Only your name is required.
          </p>
          @if (loadError(); as message) {
            <p class="mt-2 text-sm text-rose-300" role="alert">{{ message }}</p>
          }
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
        <app-tutor-profile-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      }
      @case ('edit') {
        <app-tutor-profile-form
          [profileId]="profileId()"
          [initial]="profile()"
          [canLoad]="canRead"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      }
      @case ('delete') {
        <app-delete-tutor-profile
          [profile]="{ id: profileId()!, name: name() }"
          [own]="true"
          (done)="onDeleted($event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class MyTutorProfile {
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(TutorProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notify = output<string>();

  protected readonly canRead = this.auth.hasAnyRole(TUTOR_PROFILE_READ_ROLES);

  private readonly storageKey = computed(() => {
    const id = this.auth.user()?.id;
    return id ? STORAGE_PREFIX + id : null;
  });

  protected readonly profile = signal<TutorProfileResponse | null>(null);
  protected readonly profileId = signal<string | null>(this.readStoredId());
  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly name = computed(() => {
    const p = this.profile();
    return p ? tutorName(p) : 'your profile';
  });

  constructor() {
    if (this.canRead) this.loadOwn();
  }

  protected onSaved(saved: TutorProfileSaved): void {
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

  private loadOwn(): void {
    const email = this.auth.user()?.email?.toLowerCase();
    const storedId = this.profileId();
    const id$: Observable<string | null> = storedId
      ? of(storedId)
      : email
        ? this.profiles
            .searchProfiles({ search: email.slice(0, 100), size: 5 })
            .pipe(
              map((page) => page.content.find((p) => p.email?.toLowerCase() === email)?.id ?? null),
            )
        : of(null);

    this.loading.set(true);
    id$
      .pipe(
        switchMap((id) => (id ? this.profiles.getProfile(id) : of(null))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profile) => {
          this.loading.set(false);
          this.profile.set(profile);
          this.remember(profile?.id ?? null);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          if (isApiErrorResponse(error) && error.status === 404) {
            this.remember(null);
            return;
          }
          this.loadError.set(
            isApiErrorResponse(error)
              ? error.message
              : 'Could not load your tutor profile. Try again later.',
          );
        },
      });
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
