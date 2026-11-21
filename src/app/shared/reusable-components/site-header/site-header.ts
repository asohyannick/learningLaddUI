import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  label: string;
  path: string;
  /** Section id on the target page, e.g. `platform` for `/#platform`. */
  fragment?: string;
}

/** Public marketing header: logo, main navigation and sign-in actions. */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-header.html',
})
export class SiteHeader {
  protected readonly links: readonly NavLink[] = [
    { label: 'Courses', path: '/courses' },
    { label: 'Platform', path: '/', fragment: 'platform' },
    { label: 'For schools', path: '/', fragment: 'roles' },
    { label: 'Partners', path: '/partners' },
    { label: 'Careers', path: '/jobs' },
  ];

  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
