import { JobPhoto } from '../job-photo/job-photo';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/service/auth/auth.service';
import { injectHeaderAccount } from '../../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { SiteFooter } from '../../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../../shared/reusable-components/site-header/site-header';
import { resourceApiError, resourceErrorMessage } from '../../../shared/utils/resource-error';
import { ApplyForm } from '../../job-application/apply-form/apply-form';
import { JobApplicationResponseDto } from '../../job-application/job-application.model';
import { MyApplicationStore } from '../../job-application/my-application.store';
import { JobStatus } from '../job-listing.model';
import {
  JobListingService,
  acceptsApplications,
  deadlineLabel,
  jobFacts,
} from '../job-listing.service';

/**
 * Public page of one job (`GET /job-listing/{id}`): the full description and an Apply form.
 * Drafts are treated as not found. The API needs a signed-in user, so guests are asked to sign in.
 */
@Component({
  selector: 'app-job-detail',
  imports: [JobPhoto, ApplyForm, EnumLabelPipe, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.html',
})
export class JobDetail {
  private readonly jobs = inject(JobListingService);
  private readonly title = inject(Title);
  protected readonly account = injectHeaderAccount();
  protected readonly isSignedIn = inject(AuthService).isAuthenticated;

  /** `:id` from the URL (bound by the router). */
  readonly id = input.required<string>();

  protected readonly result = rxResource({
    params: () => (this.isSignedIn() ? this.id() : undefined),
    stream: ({ params: id }) => this.jobs.getJobListing(id),
  });

  protected readonly job = computed(() => {
    if (!this.result.hasValue()) return null;
    const job = this.result.value();
    return job.status === JobStatus.DRAFT ? null : job;
  });
  protected readonly notFound = computed(
    () =>
      (this.result.hasValue() && !this.job()) ||
      [400, 404].includes(resourceApiError(this.result.error())?.status ?? 0),
  );
  protected readonly errorMessage = computed(() => resourceErrorMessage(this.result.error()));

  protected readonly facts = computed(() => {
    const job = this.job();
    return job ? jobFacts(job) : [];
  });
  protected readonly canApply = computed(() => {
    const job = this.job();
    return !!job && acceptsApplications(job);
  });
  protected readonly deadline = computed(() => {
    const job = this.job();
    return job ? deadlineLabel(job) : null;
  });
  protected readonly sections = computed(() => {
    const job = this.job();
    if (!job) return [];
    return [
      { title: 'About the role', text: job.description },
      { title: 'What you will do', text: job.responsibilities },
      { title: 'What we are looking for', text: job.requirements },
      { title: 'How to apply', text: job.applicationInstructions },
    ].filter((s): s is { title: string; text: string } => !!s.text);
  });
  protected readonly lists = computed(() => {
    const job = this.job();
    if (!job) return [];
    return [
      { title: 'Skills', items: job.skills ?? [] },
      { title: 'Certifications', items: job.certifications ?? [] },
      { title: 'Languages', items: job.languages ?? [] },
      { title: 'Benefits', items: job.benefits ?? [] },
    ].filter((list) => list.items.length);
  });

  private readonly myApplication = inject(MyApplicationStore);
  /** The API allows one application per person; it is remembered in this browser. */
  protected readonly myApplicationId = this.myApplication.applicationId;
  protected readonly applying = signal(false);
  protected readonly applied = signal(false);

  constructor() {
    effect(() => {
      const job = this.job();
      if (job) this.title.setTitle(`${job.title} | Careers | Learning Ladder`);
    });
  }

  protected onApplied(application: JobApplicationResponseDto): void {
    this.applying.set(false);
    this.applied.set(true);
    this.myApplication.remember(application.id);
  }
}
