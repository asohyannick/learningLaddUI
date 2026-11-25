import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { injectHeaderAccount } from '../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../shared/custom-pipe/enum-label-pipe';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { resourceApiError, resourceErrorMessage } from '../../shared/utils/resource-error';
import { JobListingService } from '../job-listing/job-listing.service';
import { ApplyForm } from './apply-form/apply-form';
import { JobApplicationResponseDto } from './job-application.model';
import {
  JobApplicationService,
  applicantInitials,
  applicationFacts,
  applicationStatusClassesLight,
  canEditApplication,
  shortDate,
} from './job-application.service';
import { MyApplicationStore } from './my-application.store';

@Component({
  selector: 'app-job-application',
  imports: [ApplyForm, EnumLabelPipe, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-application.html',
})
export class JobApplication {
  protected readonly account = injectHeaderAccount();
  private readonly applications = inject(JobApplicationService);
  private readonly jobs = inject(JobListingService);
  private readonly store = inject(MyApplicationStore);

  protected readonly applicationId = this.store.applicationId;

  protected readonly result = rxResource({
    params: () => this.applicationId() ?? undefined,
    stream: ({ params: id }) => this.applications.getApplication(id),
  });
  private readonly saved = signal<JobApplicationResponseDto | null>(null);
  protected readonly application = computed(
    () => this.saved() ?? (this.result.hasValue() ? this.result.value() : null),
  );

  protected readonly job = rxResource({
    params: () => this.application()?.jobListingId,
    stream: ({ params: id }) => this.jobs.getJobListing(id).pipe(catchError(() => of(null))),
  });

  protected readonly gone = computed(() =>
    [400, 403, 404].includes(resourceApiError(this.result.error())?.status ?? 0),
  );
  protected readonly errorMessage = computed(() => resourceErrorMessage(this.result.error()));

  protected readonly facts = computed(() => {
    const a = this.application();
    return a ? applicationFacts(a) : [];
  });
  protected readonly initials = computed(() => {
    const a = this.application();
    return a ? applicantInitials(a) : '';
  });
  protected readonly statusClasses = computed(() => {
    const a = this.application();
    return a ? applicationStatusClassesLight(a.status) : '';
  });
  protected readonly canEdit = computed(() => {
    const a = this.application();
    return !!a && canEditApplication(a);
  });
  protected readonly review = computed(() => {
    const a = this.application();
    if (!a) return [];
    return [
      { label: 'Interview', value: shortDate(a.interviewScheduledAt) },
      { label: 'Note from the team', value: a.reviewNote ?? '' },
      { label: 'Reason', value: a.rejectionReason ?? '' },
    ].filter((item) => item.value);
  });

  protected readonly editing = signal(false);
  protected readonly photoBroken = signal(false);
  protected readonly toast = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.gone()) this.store.forget();
    });
  }

  protected onSaved(application: JobApplicationResponseDto): void {
    this.saved.set(application);
    this.editing.set(false);
    this.photoBroken.set(false);
    this.toast.set('Your application was updated.');
  }
}
