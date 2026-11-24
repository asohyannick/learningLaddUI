import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { TutorProfileResponse } from '../tutor-profile.model';
import { hourlyRateLabel, tutorInitials, tutorName } from '../tutor-profile.service';
import { tutorStatusClasses } from '../tutor-status';

interface Row {
  label: string;
  value: string | null | undefined;
}

/** Read-only view of one tutor profile, grouped like the form. Dark dashboard styling. */
@Component({
  selector: 'app-tutor-profile-details',
  imports: [DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = profile();
    <div class="flex items-center gap-4">
      @if (p.profilePictureUrl) {
        <img
          [src]="p.profilePictureUrl"
          alt=""
          class="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-white/10"
        />
      } @else {
        <span
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-royal text-2xl font-semibold text-white"
          aria-hidden="true"
          >{{ initials() }}</span
        >
      }
      <div class="min-w-0">
        <h3 class="truncate text-xl font-semibold text-white">{{ name() }}</h3>
        @if (p.fieldOfSpecialization || p.highestQualification) {
          <p class="truncate text-sm text-slate-300">
            {{ p.fieldOfSpecialization || p.highestQualification }}
          </p>
        }
        @if (p.email) {
          <p class="truncate text-sm text-slate-400">{{ p.email }}</p>
        }
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          @if (p.tutorNumber) {
            <span
              class="rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-slate-300 ring-1 ring-inset ring-white/10"
            >
              {{ p.tutorNumber }}
            </span>
          }
          @if (p.status) {
            <span
              class="rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset"
              [class]="statusClasses()"
              >{{ p.status | enumLabel }}</span
            >
          }
          @if (rate(); as label) {
            <span
              class="rounded-full bg-amber-400/10 px-2.5 py-0.5 font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30"
              data-testid="tutor-rate"
              >{{ label }}</span
            >
          }
        </div>
      </div>
    </div>

    @if (p.description) {
      <p class="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {{ p.description }}
      </p>
    }

    @for (list of lists(); track list.title) {
      @if (list.items.length) {
        <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {{ list.title }}
        </h4>
        <ul class="mt-2 flex flex-wrap gap-2">
          @for (item of list.items; track $index) {
            <li class="rounded-full px-3 py-1 text-xs font-medium" [class]="list.classes">
              {{ item }}
            </li>
          }
        </ul>
      }
    }

    @for (group of groups(); track group.title) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {{ group.title }}
      </h4>
      <dl
        class="mt-2 divide-y divide-white/5 rounded-xl border border-white/10 bg-navy-950/40 text-sm"
      >
        @for (row of group.rows; track row.label) {
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">{{ row.label }}</dt>
            <dd class="text-right text-slate-200">{{ row.value || '—' }}</dd>
          </div>
        }
        @if (group.title === 'Teaching') {
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">Joined</dt>
            <dd class="text-right text-slate-200">
              {{ (p.joinedDate | date: 'mediumDate') || '—' }}
            </dd>
          </div>
        }
        @if (group.title === 'Personal') {
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">Date of birth</dt>
            <dd class="text-right text-slate-200">
              {{ (p.dateOfBirth | date: 'mediumDate') || '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">Gender</dt>
            <dd class="text-right text-slate-200">{{ (p.gender | enumLabel) || '—' }}</dd>
          </div>
        }
      </dl>
    }

    @if (p.linkedinUrl || p.websiteUrl) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Links</h4>
      <ul class="mt-2 space-y-2 text-sm">
        @if (p.linkedinUrl) {
          <li>
            <a
              [href]="p.linkedinUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-indigo-300 hover:underline"
              >LinkedIn ↗</a
            >
          </li>
        }
        @if (p.websiteUrl) {
          <li>
            <a
              [href]="p.websiteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-indigo-300 hover:underline"
              >Website ↗</a
            >
          </li>
        }
      </ul>
    }

    <p class="mt-6 text-xs text-slate-500">
      Created {{ (p.createdAt | date: 'medium') || '—' }} · Updated
      {{ (p.updatedAt | date: 'medium') || '—' }}
    </p>
  `,
})
export class TutorProfileDetails {
  readonly profile = input.required<TutorProfileResponse>();

  protected readonly name = computed(() => tutorName(this.profile()));
  protected readonly initials = computed(() => tutorInitials(this.profile()));
  protected readonly rate = computed(() => hourlyRateLabel(this.profile()));
  protected readonly statusClasses = computed(() => tutorStatusClasses(this.profile().status));

  protected readonly lists = computed(() => {
    const p = this.profile();
    return [
      { title: 'Subjects', items: p.subjects ?? [], classes: 'bg-royal/20 text-indigo-200' },
      { title: 'Languages', items: p.languages ?? [], classes: 'bg-sky-400/10 text-sky-200' },
      {
        title: 'Certifications',
        items: p.certifications ?? [],
        classes: 'bg-emerald-400/10 text-emerald-200',
      },
      { title: 'Hobbies', items: p.hobbies ?? [], classes: 'bg-white/5 text-slate-300' },
    ];
  });

  protected readonly groups = computed<{ title: string; rows: Row[] }[]>(() => {
    const p = this.profile();
    const address = [p.addressLine, p.city, p.stateRegion, p.postalCode].filter(Boolean).join(', ');
    const years = p.yearsOfExperience;
    return [
      {
        title: 'Teaching',
        rows: [
          { label: 'Faculty', value: p.faculty },
          { label: 'Department', value: p.department },
          { label: 'Highest qualification', value: p.highestQualification },
          { label: 'Specialisation', value: p.fieldOfSpecialization },
          {
            label: 'Experience',
            value:
              years === undefined || years === null
                ? null
                : `${years} ${years === 1 ? 'year' : 'years'}`,
          },
          { label: 'Hourly rate', value: this.rate() },
        ],
      },
      {
        title: 'Personal',
        rows: [
          { label: 'Nationality', value: p.nationality },
          { label: 'Phone', value: p.phoneNumber },
        ],
      },
      {
        title: 'Address',
        rows: [
          { label: 'Address', value: address },
          { label: 'Country', value: p.country },
        ],
      },
      {
        title: 'Emergency contact',
        rows: [
          { label: 'Name', value: p.emergencyContactName },
          { label: 'Phone', value: p.emergencyContactPhone },
          { label: 'Relationship', value: p.emergencyContactRelationship },
        ],
      },
    ];
  });
}
