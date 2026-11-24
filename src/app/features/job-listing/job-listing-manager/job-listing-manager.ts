import { ChangeDetectionStrategy, Component, output, signal, viewChild } from '@angular/core';
import { DeleteJobListing } from '../delete-job-listing/delete-job-listing';
import { FetchAllJobListings } from '../fetch-all-job-listings/fetch-all-job-listings';
import { FetchJobListing } from '../fetch-job-listing/fetch-job-listing';
import { JobListingForm, JobListingSaved } from '../job-listing-form/job-listing-form';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; listing: { id: string; title: string } };

/**
 * Job listings section of the admin dashboard: list, search, count, view, post, edit, publish,
 * delete and export as PDF. The dashboard is only open to the roles that may manage listings.
 */
@Component({
  selector: 'app-job-listing-manager',
  imports: [DeleteJobListing, FetchAllJobListings, FetchJobListing, JobListingForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-job-listings
      (add)="dialog.set({ kind: 'create' })"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-job-listing
        [jobListingId]="id"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
        (changed)="onChanged($event)"
      />
    }

    @if (dialog(); as d) {
      @if (d.kind === 'create') {
        <app-job-listing-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
      } @else if (d.kind === 'edit') {
        <app-job-listing-form
          [jobListingId]="d.id"
          (done)="onSaved($event)"
          (cancelled)="dialog.set(null)"
        />
      } @else {
        <app-delete-job-listing
          [listing]="d.listing"
          (done)="onDeleted(d.listing.id, $event)"
          (cancelled)="dialog.set(null)"
        />
      }
    }
  `,
})
export class JobListingManager {
  /** Success messages for the dashboard's toast. */
  readonly notify = output<string>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllJobListings);
  private readonly panel = viewChild(FetchJobListing);

  protected askDelete(listing: { id: string; title: string }): void {
    this.dialog.set({ kind: 'delete', listing: { id: listing.id, title: listing.title } });
  }

  protected onSaved(saved: JobListingSaved): void {
    this.dialog.set(null);
    this.list().reload();
    this.panel()?.load();
    this.notify.emit(saved.message);
  }

  protected onChanged(message: string): void {
    this.list().reload();
    this.notify.emit(message);
  }

  protected onDeleted(id: string, message: string): void {
    this.dialog.set(null);
    if (this.selectedId() === id) this.selectedId.set(null);
    this.list().reload();
    this.notify.emit(message);
  }
}
