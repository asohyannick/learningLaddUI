import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { PartnerPublic } from '../../core/interface';
import { Partnership } from './partnership';

const url = `${environment.apiUrl}/partners/public?page=0&size=12`;

function page(content: Partial<PartnerPublic>[], totalPages = 1) {
  return {
    success: true,
    status: 200,
    message: 'OK',
    data: {
      content,
      page: 0,
      size: 12,
      totalElements: content.length,
      totalPages,
      first: true,
      last: totalPages <= 1,
    },
    path: '',
    timestamp: '',
  };
}

describe('Partnership', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Partnership],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render(response: object) {
    const fixture = TestBed.createComponent(Partnership);
    fixture.detectChanges();
    backend.expectOne(url).flush(response);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows an empty state when there are no partners', async () => {
    const el = await render(page([]));
    expect(el.textContent).toContain('No partners to show yet');
  });

  it('lists partners with their tier, location and website link', async () => {
    const el = await render(
      page([
        {
          id: 'p1',
          name: 'Acme University',
          logo: null,
          partnerType: 'ACADEMIC',
          sponsorshipTier: 'GOLD',
          websiteUrl: 'https://example.org',
          city: 'Lagos',
          country: 'Nigeria',
          featured: true,
        },
      ]),
    );
    expect(el.textContent).toContain('Acme University');
    expect(el.textContent).toContain('Gold');
    expect(el.textContent).toContain('Lagos, Nigeria');
    expect(el.querySelector('a[href="https://example.org"]')?.getAttribute('rel')).toContain(
      'noopener',
    );
  });

  it('shows pagination when there is more than one page', async () => {
    const el = await render(page([{ id: 'p1', name: 'Acme' }], 3));
    expect(el.textContent).toContain('Page 1 of 3');
  });
});
