import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TIMETABLE_DELETE_ROLES } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { DeleteTimeTable } from '../delete-time-table/delete-time-table';
import { FetchAllTimeTables } from '../fetch-all-time-tables/fetch-all-time-tables';
import { FetchTimeTable } from '../fetch-time-table/fetch-time-table';
import { TimeTableForm, TimeTableSaved } from '../time-table-form/time-table-form';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; entry: { id: string; title: string } };

@Component({
  selector: 'app-time-table-manager',
  imports: [DeleteTimeTable, FetchAllTimeTables, FetchTimeTable, TimeTableForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-time-tables
      [canDelete]="canDelete()"
      (add)="dialog.set({ kind: 'create' })"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-time-table
        [timeTableId]="id"
        [canDelete]="canDelete()"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'create') {
        <app-time-table-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      } @else if (d.kind === 'edit') {
        <app-time-table-form
          [timeTableId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-time-table
          [entry]="d.entry"
          (done)="onDeleted(d.entry.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class TimeTableManager {
  private readonly auth = inject(AuthService);

  readonly notify = output<string>();

  protected readonly canDelete = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(TIMETABLE_DELETE_ROLES);
  });

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllTimeTables);
  private readonly panel = viewChild(FetchTimeTable);

  protected askDelete(entry: { id: string; title: string }): void {
    this.dialog.set({ kind: 'delete', entry: { id: entry.id, title: entry.title } });
  }

  protected onSaved(saved: TimeTableSaved): void {
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
