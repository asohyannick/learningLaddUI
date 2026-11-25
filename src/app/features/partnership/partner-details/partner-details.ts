import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { partnerStatusClasses, tierClassesDark } from '../partner-badges';
import {
  PartnerStatus,
  PartnersResponseDto,
  daysUntilAgreementEnds,
  isAgreementActive,
} from '../partnership.model';
import { partnerInitials, partnerLocation, sponsorshipLabel } from '../partnership.service';

interface Row {
  label: string;
  value: string | null | undefined;
}

@Component({
  selector: 'app-partner-details',
  imports: [DatePipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = partner();
    @if (p.bannerImage) {
      <img
        [src]="p.bannerImage"
        alt=""
        class="mb-5 h-28 w-full rounded-xl object-cover ring-1 ring-white/10"
      />
    }
    <div class="flex items-center gap-4">
      @if (p.logo) {
        <img
          [src]="p.logo"
          alt=""
          class="h-20 w-20 shrink-0 rounded-xl bg-white object-contain p-2 ring-2 ring-white/10"
        />
      } @else {
        <span
          class="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-royal text-2xl font-semibold text-white"
          aria-hidden="true"
          >{{ initials() }}</span
        >
      }
      <div class="min-w-0">
        <h3 class="truncate text-xl font-semibold text-white">{{ p.name }}</h3>
        <p class="truncate text-sm text-slate-300">
          {{ p.partnerType | enumLabel }}{{ p.industry ? ' · ' + p.industry : '' }}
        </p>
        <p class="truncate font-mono text-xs text-slate-500">/partners/{{ p.slug }}</p>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span
            class="rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset"
            [class]="statusClasses()"
            data-testid="partner-status"
            >{{ p.status | enumLabel }}</span
          >
          @if (p.sponsorshipTier) {
            <span
              class="rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset"
              [class]="tierClasses()"
              >{{ p.sponsorshipTier | enumLabel }}</span
            >
          }
          @if (p.featured) {
            <span
              class="rounded-full bg-amber-400/10 px-2.5 py-0.5 font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30"
              >Featured</span
            >
          }
          <span
            class="rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset"
            [class]="
              onWebsite()
                ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30'
                : 'bg-white/5 text-slate-400 ring-white/10'
            "
            >{{ onWebsite() ? 'On the website' : 'Not on the website' }}</span
          >
        </div>
      </div>
    </div>

    @if (agreementNotice(); as notice) {
      <p
        class="mt-5 rounded-xl border px-4 py-3 text-sm"
        [class]="
          notice.tone === 'danger'
            ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
            : 'border-amber-400/30 bg-amber-400/10 text-amber-100'
        "
        data-testid="agreement-notice"
      >
        {{ notice.text }}
      </p>
    }

    @if (p.shortDescription) {
      <p class="mt-5 text-sm font-medium text-slate-200">{{ p.shortDescription }}</p>
    }
    @if (p.description) {
      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {{ p.description }}
      </p>
    }
    @if (p.benefits) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Benefits</h4>
      <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
        {{ p.benefits }}
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
            <dd class="break-all text-right text-slate-200">{{ row.value || '—' }}</dd>
          </div>
        }
      </dl>
    }

    @if (links().length) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Online</h4>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        @for (link of links(); track link.label) {
          <li>
            <a
              [href]="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-indigo-300 hover:underline"
              >{{ link.label }} ↗</a
            >
          </li>
        }
      </ul>
    }

    @if (p.internalNotes) {
      <h4 class="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Internal notes
      </h4>
      <p
        class="mt-2 whitespace-pre-line rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-slate-300"
      >
        {{ p.internalNotes }}
      </p>
    }

    <p class="mt-6 text-xs text-slate-500">
      Created {{ (p.createdAt | date: 'medium') || '—' }} · Updated
      {{ (p.updatedAt | date: 'medium') || '—' }}
    </p>
  `,
})
export class PartnerDetails {
  readonly partner = input.required<PartnersResponseDto>();

  protected readonly initials = computed(() => partnerInitials(this.partner().name));
  protected readonly statusClasses = computed(() => partnerStatusClasses(this.partner().status));
  protected readonly tierClasses = computed(() => tierClassesDark(this.partner().sponsorshipTier));
  protected readonly onWebsite = computed(
    () => this.partner().status === PartnerStatus.ACTIVE && this.partner().showOnWebsite,
  );

  protected readonly agreementNotice = computed(() => {
    const days = daysUntilAgreementEnds(this.partner());
    if (days === null || days > 30) return null;
    if (days < 0) {
      return { tone: 'danger', text: `The agreement ended ${-days} day(s) ago.` };
    }
    return {
      tone: 'warning',
      text:
        days === 0
          ? 'The agreement ends today: consider renewing it.'
          : `The agreement ends in ${days} day(s): consider renewing it.`,
    };
  });

  protected readonly groups = computed<{ title: string; rows: Row[] }[]>(() => {
    const p = this.partner();
    const address = [p.addressLine, p.stateRegion].filter(Boolean).join(', ');
    const period =
      p.agreementStartDate || p.agreementEndDate
        ? `${p.agreementStartDate ?? '…'} → ${p.agreementEndDate ?? 'open-ended'}`
        : null;
    return [
      {
        title: 'Agreement & sponsorship',
        rows: [
          { label: 'Period', value: period },
          {
            label: 'In effect',
            value: period ? (isAgreementActive(p) ? 'Yes' : 'No') : null,
          },
          { label: 'Amount', value: sponsorshipLabel(p) },
          { label: 'Agreement document', value: p.agreementDocumentId },
          { label: 'Display order', value: String(p.displayOrder ?? 0) },
        ],
      },
      {
        title: 'Contact person',
        rows: [
          {
            label: 'Name',
            value: [p.contactPersonName, p.contactPersonTitle].filter(Boolean).join(', '),
          },
          { label: 'Email', value: p.contactEmail },
          { label: 'Phone', value: p.contactPhone },
        ],
      },
      {
        title: 'Address',
        rows: [
          { label: 'Address', value: address },
          { label: 'Location', value: partnerLocation(p) },
        ],
      },
    ];
  });

  protected readonly links = computed(() => {
    const p = this.partner();
    return [
      { label: 'Website', url: p.websiteUrl },
      { label: 'LinkedIn', url: p.linkedinUrl },
      { label: 'Facebook', url: p.facebookUrl },
      { label: 'X / Twitter', url: p.twitterUrl },
      { label: 'Instagram', url: p.instagramUrl },
    ].filter((link): link is { label: string; url: string } => !!link.url);
  });
}
