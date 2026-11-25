import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { resourceApiError, resourceErrorMessage } from '../../../shared/utils/resource-error';
import { injectHeaderAccount } from '../../../core/service/auth/header-account';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { SiteFooter } from '../../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../../shared/reusable-components/site-header/site-header';
import { tierClassesLight } from '../partner-badges';
import { PartnershipService, partnerInitials, partnerLocation } from '../partnership.service';

@Component({
  selector: 'app-partner-page',
  imports: [EnumLabelPipe, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-site-header [account]="account()" />

    <main class="pb-16">
      @if (result.isLoading()) {
        <div class="animate-pulse" role="status" aria-label="Loading partner">
          <div class="h-48 bg-line sm:h-64"></div>
          <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div class="-mt-12 h-24 w-24 rounded-2xl border-4 border-cream bg-line"></div>
            <div class="mt-4 h-7 w-1/2 rounded bg-line"></div>
            <div class="mt-3 h-4 w-3/4 rounded bg-line"></div>
          </div>
        </div>
      } @else if (result.error()) {
        <div class="mx-auto max-w-xl px-4 py-24 text-center">
          @if (notFound()) {
            <p class="font-serif text-2xl font-semibold">Partner not found</p>
            <p class="mt-2 text-muted">
              This partner may have moved, or is not listed on our website any more.
            </p>
          } @else {
            <p class="font-serif text-2xl font-semibold">We couldn't load this partner</p>
            <p class="mt-2 text-muted">{{ errorMessage() }}</p>
            <button
              type="button"
              class="mt-4 rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white hover:bg-royal-dark"
              (click)="result.reload()"
            >
              Try again
            </button>
          }
          <p class="mt-6">
            <a routerLink="/partners" class="font-semibold text-royal hover:underline"
              >← All partners &amp; sponsors</a
            >
          </p>
        </div>
      } @else if (result.hasValue()) {
        @let p = result.value();
        <div
          class="relative h-48 overflow-hidden bg-linear-to-br from-navy-900 via-royal to-navy-950 sm:h-64"
        >
          @if (p.bannerImage) {
            <img [src]="p.bannerImage" alt="" class="h-full w-full object-cover" />
          }
          <div
            class="absolute inset-0 bg-linear-to-t from-navy-950/60 to-transparent"
            aria-hidden="true"
          ></div>
        </div>

        <article class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div
              class="-mt-12 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-cream bg-white shadow-md"
            >
              @if (p.logo) {
                <img
                  [src]="p.logo"
                  [alt]="p.name + ' logo'"
                  class="h-full w-full object-contain p-2"
                />
              } @else {
                <span class="font-serif text-2xl font-semibold text-royal" aria-hidden="true">{{
                  initials()
                }}</span>
              }
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {{ p.partnerType | enumLabel }} partner
              </p>
              <h1 class="font-serif text-3xl font-semibold sm:text-4xl">{{ p.name }}</h1>
            </div>
            @if (p.websiteUrl) {
              <a
                [href]="p.websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
                >Visit website <span aria-hidden="true">↗</span
                ><span class="sr-only"> (opens in a new tab)</span></a
              >
            }
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
            @if (p.featured) {
              <span
                class="rounded-md bg-ladder/20 px-2 py-0.5 font-semibold uppercase tracking-wide text-ladder-dark"
                >Featured</span
              >
            }
            @if (p.sponsorshipTier) {
              <span
                class="rounded-md px-2 py-0.5 font-semibold uppercase tracking-wide"
                [class]="tierClass(p.sponsorshipTier)"
                >{{ p.sponsorshipTier | enumLabel }} sponsor</span
              >
            }
            @if (p.industry) {
              <span class="rounded-md bg-white px-2 py-0.5 font-medium text-muted ring-1 ring-line">
                {{ p.industry }}
              </span>
            }
            @if (place(); as where) {
              <span class="rounded-md bg-white px-2 py-0.5 font-medium text-muted ring-1 ring-line">
                {{ where }}
              </span>
            }
          </div>

          @if (p.shortDescription) {
            <p class="mt-6 text-lg leading-relaxed text-ink">{{ p.shortDescription }}</p>
          }

          <div class="mt-8 grid gap-8 md:grid-cols-[1fr_16rem]">
            <div class="space-y-8">
              @if (p.description) {
                <section>
                  <h2 class="font-serif text-xl font-semibold">About {{ p.name }}</h2>
                  <p class="mt-3 whitespace-pre-line leading-relaxed text-muted">
                    {{ p.description }}
                  </p>
                </section>
              }
              @if (p.benefits) {
                <section>
                  <h2 class="font-serif text-xl font-semibold">What this partnership brings</h2>
                  <p class="mt-3 whitespace-pre-line leading-relaxed text-muted">
                    {{ p.benefits }}
                  </p>
                </section>
              }
              @if (!p.description && !p.benefits) {
                <p class="text-muted">More about this partner is coming soon.</p>
              }
            </div>

            @if (links().length) {
              <aside class="h-fit rounded-2xl border border-line bg-white p-5">
                <h2 class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Find them online
                </h2>
                <ul class="mt-3 space-y-2 text-sm">
                  @for (link of links(); track link.label) {
                    <li>
                      <a
                        [href]="link.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-semibold text-royal hover:underline"
                        >{{ link.label }} <span aria-hidden="true">↗</span
                        ><span class="sr-only"> (opens in a new tab)</span></a
                      >
                    </li>
                  }
                </ul>
              </aside>
            }
          </div>

          <p class="mt-12">
            <a routerLink="/partners" class="font-semibold text-royal hover:underline"
              >← All partners &amp; sponsors</a
            >
          </p>
        </article>
      }
    </main>

    <app-site-footer />
  `,
})
export class PartnerPage {
  protected readonly account = injectHeaderAccount();
  private readonly partners = inject(PartnershipService);
  private readonly title = inject(Title);

  readonly slug = input.required<string>();

  protected readonly result = rxResource({
    params: () => this.slug(),
    stream: ({ params: slug }) => this.partners.getPublicPartner(slug),
  });

  protected readonly notFound = computed(
    () => resourceApiError(this.result.error())?.status === 404,
  );

  protected readonly errorMessage = computed(() => resourceErrorMessage(this.result.error()));

  protected readonly initials = computed(() =>
    this.result.hasValue() ? partnerInitials(this.result.value().name) : '',
  );
  protected readonly place = computed(() =>
    this.result.hasValue() ? partnerLocation(this.result.value()) : '',
  );
  protected readonly tierClass = tierClassesLight;

  protected readonly links = computed(() => {
    if (!this.result.hasValue()) return [];
    const p = this.result.value();
    return [
      { label: 'Website', url: p.websiteUrl },
      { label: 'LinkedIn', url: p.linkedinUrl },
      { label: 'Facebook', url: p.facebookUrl },
      { label: 'X / Twitter', url: p.twitterUrl },
      { label: 'Instagram', url: p.instagramUrl },
    ].filter((link): link is { label: string; url: string } => !!link.url);
  });

  constructor() {
    effect(() => {
      if (this.result.hasValue()) {
        this.title.setTitle(`${this.result.value().name} | Learning Ladder`);
      }
    });
  }
}
