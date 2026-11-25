import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { STUDENT_PROFILE_ADMIN_ROLES } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { DeleteStudentProfile } from '../delete-student-profile/delete-student-profile';
import { FetchAllStudentProfiles } from '../fetch-all-student-profiles/fetch-all-student-profiles';
import { FetchStudentProfile } from '../fetch-student-profile/fetch-student-profile';
import {
  StudentProfileForm,
  StudentProfileSaved,
} from '../student-profile-form/student-profile-form';
import { fullName } from '../student-profile.service';

type Dialog =
  { kind: 'edit'; id: string } | { kind: 'delete'; profile: { id: string; name: string } };

@Component({
  selector: 'app-student-profile-manager',
  imports: [DeleteStudentProfile, FetchAllStudentProfiles, FetchStudentProfile, StudentProfileForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-student-profiles
      [canManage]="canManage()"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-student-profile
        [profileId]="id"
        [canManage]="canManage()"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'edit') {
        <app-student-profile-form
          [profileId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-student-profile
          [profile]="d.profile"
          (done)="onDeleted(d.profile.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class StudentProfileManager {
  private readonly auth = inject(AuthService);

  readonly notify = output<string>();

  protected readonly canManage = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(STUDENT_PROFILE_ADMIN_ROLES);
  });

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllStudentProfiles);
  private readonly panel = viewChild(FetchStudentProfile);

  protected askDelete(profile: { id: string; firstName: string; lastName: string }): void {
    this.dialog.set({ kind: 'delete', profile: { id: profile.id, name: fullName(profile) } });
  }

  protected onSaved(saved: StudentProfileSaved): void {
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
