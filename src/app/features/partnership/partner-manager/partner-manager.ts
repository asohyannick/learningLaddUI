import { ChangeDetectionStrategy, Component, output, signal, viewChild } from '@angular/core';
import { DeletePartner } from '../delete-partner/delete-partner';
import { FetchAllPartners } from '../fetch-all-partners/fetch-all-partners';
import { FetchPartner } from '../fetch-partner/fetch-partner';
import { PartnerForm, PartnerSaved } from '../partner-form/partner-form';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; partner: { id: string; name: string } };

/**
 * Partners section of the admin dashboard (super admin, admin, IT admin): list, search,
 * count, view, add, edit, delete and export as PDF.
 */
@Component({
  selector: 'app-partner-manager',
  imports: [DeletePartner, FetchAllPartners, FetchPartner, PartnerForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-partners
      (add)="dialog.set({ kind: 'create' })"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-partner
        [partnerId]="id"
        [canManage]="true"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'create') {
        <app-partner-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      } @else if (d.kind === 'edit') {
        <app-partner-form
          [partnerId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-partner
          [partner]="d.partner"
          (done)="onDeleted(d.partner.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class PartnerManager {
  /** Success messages for the dashboard's toast. */
  readonly notify = output<string>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllPartners);
  private readonly panel = viewChild(FetchPartner);

  protected askDelete(partner: { id: string; name: string }): void {
    this.dialog.set({ kind: 'delete', partner: { id: partner.id, name: partner.name } });
  }

  protected onSaved(saved: PartnerSaved): void {
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
