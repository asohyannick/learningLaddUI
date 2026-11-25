import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { resourceErrorMessage } from '../../shared/utils/resource-error';
import { injectHeaderAccount } from '../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../shared/custom-pipe/enum-label-pipe';
import { PageHero } from '../../shared/reusable-components/page-hero/page-hero';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';
import { tierClassesLight } from './partner-badges';
import {
  PARTNER_TYPES,
  PagedQueryRequestDto,
  PartnerType,
  SPONSORSHIP_TIERS,
  SponsorshipTier,
} from './partnership.model';
import { PartnershipService, partnerLocation } from './partnership.service';

const PAGE_SIZE = 12;

@Component({
  selector: 'app-partnership',
  imports: [EnumLabelPipe, NgOptimizedImage, PageHero, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partnership.html',
})
export class Partnership {
  protected readonly account = injectHeaderAccount();
  private readonly partnershipService = inject(PartnershipService);

  protected readonly types = PARTNER_TYPES;
  protected readonly tiers = SPONSORSHIP_TIERS;

  protected readonly keywordText = signal('');
  private readonly keyword = toSignal(
    toObservable(this.keywordText).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );
  protected readonly partnerType = signal<PartnerType | ''>('');
  protected readonly tier = signal<SponsorshipTier | ''>('');
  protected readonly sponsorsOnly = signal(false);

  protected readonly page = signal(0);

  private readonly query = computed<PagedQueryRequestDto>(() => ({
    keyword: this.keyword().trim() || undefined,
    partnerType: this.partnerType() || undefined,
    sponsorshipTier: this.tier() || undefined,
    sponsorsOnly: this.sponsorsOnly() || undefined,
    page: this.page(),
    size: PAGE_SIZE,
  }));

  protected readonly isFiltered = computed(() => {
    const q = this.query();
    return !!(q.keyword || q.partnerType || q.sponsorshipTier || q.sponsorsOnly);
  });

  protected readonly hasInput = computed(() => this.isFiltered() || !!this.keywordText());

  protected readonly result = rxResource({
    params: () => ({ query: this.query(), search: this.isFiltered() }),
    stream: ({ params }) =>
      params.search
        ? this.partnershipService.searchPublicPartners(params.query)
        : this.partnershipService.getPublicPartners(params.query.page, PAGE_SIZE),
  });

  protected readonly partners = computed(() =>
    this.result.hasValue() ? this.result.value().content : [],
  );

  protected readonly totalPages = computed(() =>
    this.result.hasValue() ? this.result.value().totalPages : 0,
  );

  protected readonly errorMessage = computed(() => resourceErrorMessage(this.result.error()));

  protected readonly skeletonSlots = [0, 1, 2, 3, 4, 5];
  protected readonly tierClass = tierClassesLight;
  protected readonly location = partnerLocation;

  protected setFilter<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.page.set(0);
  }

  protected clearFilters(): void {
    this.keywordText.set('');
    this.partnerType.set('');
    this.tier.set('');
    this.sponsorsOnly.set(false);
    this.page.set(0);
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
