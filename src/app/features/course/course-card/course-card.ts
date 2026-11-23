import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseSummary } from '../../../core/interface';
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { finalPrice } from '../course.service';

const THUMBNAIL_FALLBACKS = ['bg-royal', 'bg-ladder', 'bg-navy-900'];

/**
 * Public course card (home page and catalogue). The title opens the course on the catalogue
 * page (`/courses?course=<id>`), where the details, promo video and PDF are.
 */
@Component({
  selector: 'app-course-card',
  imports: [CurrencyPipe, EnumLabelPipe, NgOptimizedImage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    @let c = course();
    <article
      class="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div class="relative h-36" [class]="fallbackClass()">
        @if (c.thumbnailUrl) {
          <img [ngSrc]="c.thumbnailUrl" fill class="object-cover" alt="" />
        }
        @if (c.promoVideoUrl) {
          <span
            class="absolute bottom-2 right-2 rounded-full bg-navy-950/80 px-2 py-0.5 text-[0.65rem] font-semibold text-white"
            >▶ Video</span
          >
        }
      </div>
      <div class="flex flex-1 flex-col p-4">
        <div class="flex flex-wrap gap-1.5 text-[0.65rem] font-medium">
          @if (c.category) {
            <span class="rounded bg-royal-soft px-1.5 py-0.5 text-royal">{{ c.category }}</span>
          }
          @if (c.level) {
            <span class="rounded bg-cream px-1.5 py-0.5 text-muted">{{ c.level | enumLabel }}</span>
          }
          @if (c.durationMinutes) {
            <span class="rounded bg-cream px-1.5 py-0.5 text-muted">{{ duration() }}</span>
          }
        </div>
        <h3 class="mt-3 font-serif text-lg font-semibold">
          <!-- The stretched link makes the whole card open the course. -->
          <a
            routerLink="/courses"
            [queryParams]="{ course: c.id }"
            class="after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:underline"
            >{{ c.name }}</a
          >
        </h3>
        @if (c.shortDescription) {
          <p class="mt-1 line-clamp-2 text-xs text-muted">{{ c.shortDescription }}</p>
        }
        <div class="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <p class="font-semibold">
            @if (price() === 0) {
              Free
            } @else {
              {{ price() | currency: c.currency }}
              @if (c.discount > 0) {
                <s class="ml-1 text-xs font-normal text-muted">{{
                  c.price | currency: c.currency
                }}</s>
              }
            }
          </p>
          <a
            routerLink="/cart"
            class="relative z-10 rounded-lg bg-royal px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-royal-dark"
            [attr.aria-label]="'Add ' + c.name + ' to cart'"
            >Add to cart</a
          >
        </div>
      </div>
    </article>
  `,
})
export class CourseCard {
  readonly course = input.required<CourseSummary>();
  /** Position in the list; picks the background shown without a thumbnail. */
  readonly index = input(0);

  protected readonly price = computed(() => finalPrice(this.course()));
  protected readonly fallbackClass = computed(
    () => THUMBNAIL_FALLBACKS[this.index() % THUMBNAIL_FALLBACKS.length],
  );
  protected readonly duration = computed(() => {
    const minutes = this.course().durationMinutes ?? 0;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
  });
}
