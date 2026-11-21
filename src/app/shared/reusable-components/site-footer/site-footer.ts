import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  /** `null` until the page exists; the item is shown as plain text. */
  path: string | null;
}

interface FooterColumn {
  heading: string;
  links: readonly FooterLink[];
}

/** Public marketing footer. */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-footer.html',
})
export class SiteFooter {
  protected readonly year = new Date().getFullYear();

  protected readonly columns: readonly FooterColumn[] = [
    {
      heading: 'Platform',
      links: [
        { label: 'Courses', path: '/courses' },
        { label: 'Library', path: '/library' },
        { label: 'AI assistants', path: '/assistant' },
        { label: 'Payments', path: '/payments' },
      ],
    },
    {
      heading: 'Company',
      links: [
        // TODO: add routes for About and the Support pages once they are designed.
        { label: 'About', path: null },
        { label: 'Careers', path: '/jobs' },
        { label: 'Partners', path: '/partners' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help centre', path: null },
        { label: 'Contact us', path: null },
        { label: 'Privacy', path: null },
        { label: 'Terms', path: null },
      ],
    },
  ];
}
