import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * A job listing's photo. When there is no photo, or the link does not load (deleted file,
 * expired storage link, mistyped URL), it shows a briefcase placeholder instead of the browser's
 * broken-image icon, or nothing at all with `hideWhenMissing`. Size it with classes on the host.
 */
@Component({
  selector: 'app-job-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'overflow-hidden',
    '[class.block]': 'visible()',
    '[class.hidden]': '!visible()',
  },
  template: `
    @if (showImage()) {
      <img [src]="src()" alt="" class="h-full w-full object-cover" (error)="failedSrc.set(src())" />
    } @else if (!hideWhenMissing()) {
      <div
        class="grid h-full w-full place-items-center"
        [class]="
          tone() === 'dark'
            ? 'bg-linear-to-br from-indigo-500/20 to-teal-500/20 text-indigo-200'
            : 'bg-linear-to-br from-royal-soft to-cream text-royal'
        "
        data-testid="job-photo-placeholder"
      >
        <svg
          class="h-1/3 max-h-12 min-h-4 w-auto"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.321.947-2.489 2.294-2.676A41.047 41.047 0 0 1 6 4.193V3.75Zm6.5 0v.325a41.622 41.622 0 0 0-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25ZM10 10a1 1 0 0 0-1 1v.01a1 1 0 0 0 1 1h.01a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1H10Z"
            clip-rule="evenodd"
          />
          <path
            d="M3 15.055v-.684c.126.053.255.1.39.142 2.092.642 4.313.987 6.61.987 2.297 0 4.518-.345 6.61-.987.135-.041.264-.089.39-.142v.684c0 1.347-.985 2.53-2.363 2.686a41.454 41.454 0 0 1-9.274 0C3.985 17.585 3 16.402 3 15.055Z"
          />
        </svg>
      </div>
    }
  `,
})
export class JobPhoto {
  readonly src = input<string | null | undefined>(null);
  readonly tone = input<'light' | 'dark'>('light');
  /** Render nothing (instead of a placeholder) when there is no photo or it fails to load. */
  readonly hideWhenMissing = input(false);

  /** The link that failed; a new link gets a fresh try. */
  protected readonly failedSrc = signal<string | null | undefined>(null);
  protected readonly showImage = computed(() => !!this.src() && this.src() !== this.failedSrc());
  protected readonly visible = computed(() => this.showImage() || !this.hideWhenMissing());
}
