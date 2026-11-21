import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Navy banner at the top of public pages (Partners, Careers...). Extra content can be projected. */
@Component({
  selector: 'app-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bg-navy-900 text-white">
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
        @if (eyebrow()) {
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-ladder">
            {{ eyebrow() }}
          </p>
        }
        <h1 class="mt-3 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
          {{ title() }}
        </h1>
        @if (description()) {
          <p class="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">{{ description() }}</p>
        }
        <ng-content />
      </div>
    </section>
  `,
})
export class PageHero {
  readonly eyebrow = input<string>();
  readonly title = input.required<string>();
  readonly description = input<string>();
}
