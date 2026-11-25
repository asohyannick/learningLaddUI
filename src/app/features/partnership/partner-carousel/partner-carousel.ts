import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { PartnerPublicResponseDto } from '../partnership.model';
import { partnerInitials } from '../partnership.service';

const MIN_ITEMS_PER_LOOP = 10;
const SECONDS_PER_ITEM = 3;

interface Slide {
  key: string;
  partner: PartnerPublicResponseDto;
  initials: string;
  copy: boolean;
}

@Component({
  selector: 'app-partner-carousel',
  imports: [EnumLabelPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .marquee {
      mask-image: linear-gradient(to right, transparent, #000 6%, #000 94%, transparent);
    }
    .track {
      animation: partner-marquee var(--duration) linear infinite;
    }
    .marquee:hover .track,
    .marquee:focus-within .track,
    .paused .track {
      animation-play-state: paused;
    }
    @keyframes partner-marquee {
      from {
        transform: translateX(0);
      }
      to {
        transform: translateX(-50%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .marquee {
        overflow-x: auto;
        mask-image: none;
      }
      .track {
        animation: none;
      }
      .copy,
      .motion-control {
        display: none;
      }
    }
  `,
  template: `
    <div class="relative">
      <div
        class="marquee overflow-hidden py-2"
        [class.paused]="paused()"
        role="region"
        aria-roledescription="carousel"
        aria-label="Our partners and sponsors"
      >
        <ul class="track flex w-max" [style.--duration]="duration()">
          @for (slide of slides(); track slide.key) {
            <li
              class="shrink-0 pr-4"
              [class.copy]="slide.copy"
              [attr.aria-hidden]="slide.copy ? 'true' : null"
            >
              <a
                [routerLink]="['/partners', slide.partner.slug]"
                [attr.tabindex]="slide.copy ? -1 : null"
                class="group flex h-20 w-52 items-center gap-3 rounded-xl border border-line bg-white px-4 shadow-sm transition hover:-translate-y-0.5 hover:border-royal/40 hover:shadow-md sm:w-60"
                [title]="slide.partner.name"
              >
                <span
                  class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-cream"
                >
                  @if (slide.partner.logo) {
                    <img
                      [src]="slide.partner.logo"
                      alt=""
                      class="h-full w-full object-contain p-1"
                      loading="lazy"
                    />
                  } @else {
                    <span class="font-serif text-sm font-semibold text-royal" aria-hidden="true">{{
                      slide.initials
                    }}</span>
                  }
                </span>
                <span class="min-w-0">
                  <span
                    class="block truncate text-sm font-semibold text-ink group-hover:text-royal"
                    >{{ slide.partner.name }}</span
                  >
                  <span class="block truncate text-xs text-muted">
                    {{
                      slide.partner.sponsorshipTier
                        ? (slide.partner.sponsorshipTier | enumLabel) + ' sponsor'
                        : (slide.partner.partnerType | enumLabel)
                    }}
                  </span>
                </span>
              </a>
            </li>
          }
        </ul>
      </div>

      <button
        type="button"
        class="motion-control absolute -bottom-9 right-0 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-royal"
        [attr.aria-pressed]="paused()"
        (click)="paused.set(!paused())"
      >
        @if (paused()) {
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.34-5.89a1.5 1.5 0 0 0 0-2.54L6.3 2.84Z"
            />
          </svg>
          Play
        } @else {
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .41.34.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5ZM12.75 3a.75.75 0 0 0-.75.75v12.5c0 .41.34.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z"
            />
          </svg>
          Pause
        }
        <span class="sr-only">the partner carousel</span>
      </button>
    </div>
  `,
})
export class PartnerCarousel {
  readonly partners = input.required<readonly PartnerPublicResponseDto[]>();

  protected readonly paused = signal(false);

  protected readonly slides = computed<Slide[]>(() => {
    const partners = this.partners();
    if (!partners.length) return [];
    const repeats = Math.ceil(MIN_ITEMS_PER_LOOP / partners.length);
    const loop = Array.from({ length: repeats }, () => partners).flat();
    return [...loop, ...loop].map((partner, i) => ({
      key: `${i}-${partner.id}`,
      partner,
      initials: partnerInitials(partner.name),
      copy: i >= partners.length,
    }));
  });

  protected readonly duration = computed(() => {
    const perLoop = this.slides().length / 2;
    return `${Math.max(perLoop * SECONDS_PER_ITEM, 20)}s`;
  });
}
