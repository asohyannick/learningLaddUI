import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  COURSE_DELETE_ROLES,
  COURSE_WRITE_ROLES,
} from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { CourseForm } from '../course-form/course-form';
import { DeleteCourse } from '../delete-course/delete-course';
import { FetchAllCourses } from '../fetch-all-courses/fetch-all-courses';
import { FetchCourse } from '../fetch-course/fetch-course';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; course: { id: string; name: string } };

@Component({
  selector: 'app-course-manager',
  imports: [CourseForm, DeleteCourse, FetchAllCourses, FetchCourse],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canWrite()) {
      <div class="mb-6 flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-royal/20 hover:bg-royal-dark"
          (click)="dialog.set({ kind: 'create' })"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"
            />
          </svg>
          New course
        </button>
      </div>
    }

    <app-fetch-all-courses
      [canWrite]="canWrite()"
      [canDelete]="canDelete()"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="dialog.set({ kind: 'delete', course: $event })"
    />

    @if (selectedId(); as id) {
      <app-fetch-course
        [courseId]="id"
        [canWrite]="canWrite()"
        [canDelete]="canDelete()"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="dialog.set({ kind: 'delete', course: $event })"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'create') {
        <app-course-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      } @else if (d.kind === 'edit') {
        <app-course-form
          [courseId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-course
          [course]="d.course"
          (done)="onDeleted(d.course.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class CourseManager {
  private readonly auth = inject(AuthService);

  readonly notify = output<string>();

  protected readonly canWrite = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(COURSE_WRITE_ROLES);
  });
  protected readonly canDelete = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(COURSE_DELETE_ROLES);
  });

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllCourses);
  private readonly panel = viewChild(FetchCourse);

  protected onSaved(message: string): void {
    this.dialog.set(null);
    this.list().reload();
    this.panel()?.load();
    this.notify.emit(message);
  }

  protected onDeleted(id: string, message: string): void {
    this.dialog.set(null);
    if (this.selectedId() === id) this.selectedId.set(null);
    this.list().reload();
    this.notify.emit(message);
  }
}
