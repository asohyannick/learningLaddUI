import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { StudentProfileResponse } from '../student-profile.model';
import { fullName, profileInitials } from '../student-profile.service';

interface Row {
  label: string;
  value: string | null | undefined;
}

@Component({
  selector: 'app-student-profile-details',
  imports: [DatePipe, DecimalPipe, EnumLabelPipe],
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
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-royal to-indigo-500 text-2xl font-semibold text-white"
          aria-hidden="true"
          >{{ initials() }}</span
        >
      }
      <div class="min-w-0">
        <h3 class="truncate text-xl font-semibold text-white">{{ name() }}</h3>
        @if (p.email) {
          <p class="truncate text-sm text-slate-400">{{ p.email }}</p>
        }
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          @if (p.studentNumber) {
            <span
              class="rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-slate-300 ring-1 ring-inset ring-white/10"
            >
              {{ p.studentNumber }}
            </span>
          }
          @if (p.enrollmentStatus) {
            <span
              class="rounded-full bg-emerald-400/10 px-2.5 py-0.5 font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
              >{{ p.enrollmentStatus | enumLabel }}</span
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
        @if (group.title === 'Academic') {
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">GPA</dt>
            <dd class="text-right text-slate-200">
              {{ p.gpa !== undefined && p.gpa !== null ? (p.gpa | number: '1.2-2') : '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">Admitted</dt>
            <dd class="text-right text-slate-200">
              {{ (p.admissionDate | date: 'mediumDate') || '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3">
            <dt class="text-slate-400">Expected graduation</dt>
            <dd class="text-right text-slate-200">
              {{ (p.expectedGraduationDate | date: 'mediumDate') || '—' }}
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

    @if (p.hobbies?.length) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Hobbies</h4>
      <ul class="mt-2 flex flex-wrap gap-2">
        @for (hobby of p.hobbies; track $index) {
          <li class="rounded-full bg-royal/20 px-3 py-1 text-xs font-medium text-indigo-200">
            {{ hobby }}
          </li>
        }
      </ul>
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
export class StudentProfileDetails {
  readonly profile = input.required<StudentProfileResponse>();

  protected readonly name = computed(() => fullName(this.profile()));
  protected readonly initials = computed(() => profileInitials(this.profile()));

  protected readonly groups = computed<{ title: string; rows: Row[] }[]>(() => {
    const p = this.profile();
    const address = [p.addressLine, p.city, p.stateRegion, p.postalCode].filter(Boolean).join(', ');
    return [
      {
        title: 'Academic',
        rows: [
          { label: 'Faculty', value: p.faculty },
          { label: 'Department', value: p.department },
          { label: 'Programme', value: p.programOfStudy },
          { label: 'Year of study', value: p.currentLevel ? `Year ${p.currentLevel}` : null },
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
