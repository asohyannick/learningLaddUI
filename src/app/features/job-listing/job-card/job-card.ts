import { JobPhoto } from '../job-photo/job-photo';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { JobListingSummaryResponseDto } from '../job-listing.model';
import { acceptsApplications, deadlineLabel, jobLocation } from '../job-listing.service';

@Component({
  selector: 'app-job-card',
  imports: [JobPhoto, EnumLabelPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @let j = job();
    <article
      class="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      @if (j.jobPhotoUrl) {
        <app-job-photo [src]="j.jobPhotoUrl" [hideWhenMissing]="true" class="h-32 w-full" />
      }
      <div class="flex flex-1 flex-col p-5">
        <div class="flex flex-wrap gap-1.5 text-[0.65rem] font-medium">
          <span class="rounded bg-royal-soft px-1.5 py-0.5 text-royal">{{
            j.employmentType | enumLabel
          }}</span>
          <span class="rounded bg-cream px-1.5 py-0.5 text-muted">{{
            j.workMode | enumLabel
          }}</span>
          @if (j.experienceLevel) {
            <span class="rounded bg-cream px-1.5 py-0.5 text-muted">{{
              j.experienceLevel | enumLabel
            }}</span>
          }
        </div>
        <h3 class="mt-3 font-serif text-lg font-semibold">
          <a
            [routerLink]="['/jobs', j.id]"
            class="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:underline"
            >{{ j.title }}</a
          >
        </h3>
        @if (team()) {
          <p class="mt-0.5 text-xs text-muted">{{ team() }}</p>
        }
        @if (j.shortDescription) {
          <p class="mt-2 line-clamp-3 text-sm text-muted">{{ j.shortDescription }}</p>
        }
        <div
          class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs"
        >
          <span class="text-muted">
            {{ location() || 'Location to be confirmed' }} · {{ j.numberOfVacancies }}
            {{ j.numberOfVacancies === 1 ? 'opening' : 'openings' }}
          </span>
          @if (deadline(); as d) {
            <span class="font-semibold" [class]="open() ? 'text-royal' : 'text-rose-600'">{{
              d
            }}</span>
          }
        </div>
      </div>
    </article>
  `,
})
export class JobCard {
  readonly job = input.required<JobListingSummaryResponseDto>();

  protected readonly location = computed(() => jobLocation(this.job()));
  protected readonly team = computed(() =>
    [this.job().department, this.job().faculty].filter(Boolean).join(' · '),
  );
  protected readonly deadline = computed(() => deadlineLabel(this.job()));
  protected readonly open = computed(() => acceptsApplications(this.job()));
}
