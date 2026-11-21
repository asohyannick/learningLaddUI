import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/service/auth/auth.service';
import { PageHero } from '../../shared/reusable-components/page-hero/page-hero';
import { SiteFooter } from '../../shared/reusable-components/site-footer/site-footer';
import { SiteHeader } from '../../shared/reusable-components/site-header/site-header';

/** Public Careers page. */
@Component({
  selector: 'app-job-listing',
  imports: [PageHero, RouterLink, SiteFooter, SiteHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-listing.html',
})
export class JobListing {
  protected readonly isSignedIn = inject(AuthService).isAuthenticated;
}
