import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DeleteJobApplication } from '../delete-job-application/delete-job-application';
import { FetchAllJobApplications } from '../fetch-all-job-applications/fetch-all-job-applications';
import { FetchJobApplication } from '../fetch-job-application/fetch-job-application';
import { JobApplicationResponseDto } from '../job-application.model';
import { applicantName } from '../job-application.service';
import { MyApplicationStore } from '../my-application.store';
import { SubmitJobApplication } from '../submit-job-application/submit-job-application';

/**
 * Job applications section of the admin dashboard: submit, list, search, count, view, download
 * and delete. Only applicants can edit their own applications; the API has no staff update.
 */
@Component({
  selector: 'app-job-application-manager',
  imports: [
    DeleteJobApplication,
    FetchAllJobApplications,
    FetchJobApplication,
    SubmitJobApplication,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-job-applications
      (add)="submitting.set(true)"
      (view)="selectedId.set($event.id)"
      (remove)="askDelete($event)"
    />

    @if (selectedId(); as id) {
      <app-fetch-job-application
        [applicationId]="id"
        (closed)="selectedId.set(null)"
        (remove)="askDelete($event)"
      />
    }

    @if (submitting()) {
      <app-submit-job-application
        (done)="onSubmitted($event)"
        (cancelled)="submitting.set(false)"
      />
    }

    @if (deleting(); as target) {
      <app-delete-job-application
        [application]="target"
        (done)="onDeleted(target.id, $event)"
        (cancelled)="deleting.set(null)"
      />
    }
  `,
})
export class JobApplicationManager {
  private readonly myApplication = inject(MyApplicationStore);

  readonly notify = output<string>();

  protected readonly selectedId = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly deleting = signal<{ id: string; name: string } | null>(null);

  private readonly list = viewChild.required(FetchAllJobApplications);

  protected askDelete(application: JobApplicationResponseDto): void {
    this.deleting.set({ id: application.id, name: applicantName(application) });
  }

  protected onSubmitted(application: JobApplicationResponseDto): void {
    this.submitting.set(false);
    // Under the signed-in account, so it also shows on their "My application" page.
    this.myApplication.remember(application.id);
    this.list().reload();
    this.notify.emit(`The application from ${applicantName(application)} was submitted.`);
  }

  protected onDeleted(id: string, message: string): void {
    this.deleting.set(null);
    if (this.selectedId() === id) this.selectedId.set(null);
    if (this.myApplication.applicationId() === id) this.myApplication.forget();
    this.list().reload();
    this.notify.emit(message);
  }
}
