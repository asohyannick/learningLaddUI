import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiErrorResponse, SponsorshipTier, isApiErrorResponse } from '../../core/interface';
import { EnumLabelPipe } from '../../shared/custom-pipe/enum-label-pipe';
import { PageHero } from '../../shared/reusable-components/page-hero/page-hero';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { PartnershipService } from './partnership.service';
import { injectHeaderAccount } from '../../core/service/auth/header-account';

const PAGE_SIZE = 12;

const TIER_BADGE: Record<SponsorshipTier, string> = {
  PLATINUM: 'bg-navy-900 text-white',
  GOLD: 'bg-ladder text-ink',
  SILVER: 'bg-slate-200 text-slate-700',
  BRONZE: 'bg-orange-100 text-orange-800',
  SUPPORTER: 'bg-royal-soft text-royal',
};

/** Public "Partners & sponsors" page. */
@Component({
  selector: 'app-partnership',
  imports: [EnumLabelPipe, NgOptimizedImage, PageHero, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partnership.html',
})
export class Partnership {
  protected readonly account = injectHeaderAccount();
  private readonly partnershipService = inject(PartnershipService);

  /** Zero-based page index. */
  protected readonly page = signal(0);

  protected readonly result = rxResource({
    params: () => this.page(),
    stream: ({ params: page }) => this.partnershipService.getPublicPartners(page, PAGE_SIZE),
  });

  protected readonly partners = computed(() =>
    this.result.hasValue() ? this.result.value().content : [],
  );

  protected readonly totalPages = computed(() =>
    this.result.hasValue() ? this.result.value().totalPages : 0,
  );

  protected readonly errorMessage = computed(() => {
    const error = this.result.error() as ApiErrorResponse | Error | undefined;
    return isApiErrorResponse(error) ? error.message : 'Please try again in a moment.';
  });

  protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5];

  protected tierClass(tier: SponsorshipTier | null): string {
    return tier ? TIER_BADGE[tier] : '';
  }

  protected location(city: string | null, country: string | null): string {
    return [city, country].filter(Boolean).join(', ');
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
