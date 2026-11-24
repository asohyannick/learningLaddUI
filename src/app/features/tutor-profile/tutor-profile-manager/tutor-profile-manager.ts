import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TUTOR_PROFILE_ADMIN_ROLES } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { DeleteTutorProfile } from '../delete-tutor-profile/delete-tutor-profile';
import { FetchAllTutorProfiles } from '../fetch-all-tutor-profiles/fetch-all-tutor-profiles';
import { FetchTutorProfile } from '../fetch-tutor-profile/fetch-tutor-profile';
import { TutorProfileForm, TutorProfileSaved } from '../tutor-profile-form/tutor-profile-form';
import { tutorName } from '../tutor-profile.service';

type Dialog =
  { kind: 'edit'; id: string } | { kind: 'delete'; profile: { id: string; name: string } };

/**
 * Tutor directory for staff and student dashboards: list, search, count, open and export as PDF.
 * Admins can also edit and delete. Profiles are created by the tutors themselves.
 */
@Component({
  selector: 'app-tutor-profile-manager',
  imports: [DeleteTutorProfile, FetchAllTutorProfiles, FetchTutorProfile, TutorProfileForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-tutor-profiles
      [canManage]="canManage()"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-tutor-profile
        [profileId]="id"
        [canManage]="canManage()"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'edit') {
        <app-tutor-profile-form
          [profileId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-tutor-profile
          [profile]="d.profile"
          (done)="onDeleted(d.profile.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class TutorProfileManager {
  private readonly auth = inject(AuthService);

  /** Success messages for the dashboard's toast. */
  readonly notify = output<string>();

  protected readonly canManage = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(TUTOR_PROFILE_ADMIN_ROLES);
  });

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllTutorProfiles);
  private readonly panel = viewChild(FetchTutorProfile);

  protected askDelete(profile: {
    id: string;
    title?: string;
    firstName: string;
    lastName: string;
  }): void {
    this.dialog.set({ kind: 'delete', profile: { id: profile.id, name: tutorName(profile) } });
  }

  protected onSaved(saved: TutorProfileSaved): void {
    this.dialog.set(null);
    this.list().reload();
    this.panel()?.load();
    this.notify.emit(saved.message);
  }

  protected onDeleted(id: string, message: string): void {
    this.dialog.set(null);
    if (this.selectedId() === id) this.selectedId.set(null);
    this.list().reload();
    this.notify.emit(message);
  }
}
