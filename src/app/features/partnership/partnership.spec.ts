import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { fakePublicPartner } from '../../core/testing/fake-partner';
import { PartnerPublicResponseDto, PartnerType, SponsorshipTier } from './partnership.model';
import { Partnership } from './partnership';

const api = `${environment.apiUrl}/partners/public`;
const url = `${api}?page=0&size=12`;

function page(content: PartnerPublicResponseDto[], totalPages = 1) {
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
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows an empty state when there are no partners', async () => {
    const { el } = await render(page([]));
    expect(el.textContent).toContain('No partners to show yet');
  });

  it('lists partners with their tier, location, page link and website link', async () => {
    const { el } = await render(
      page([
        fakePublicPartner({
          name: 'Acme University',
          slug: 'acme-university',
          partnerType: PartnerType.ACADEMIC,
          sponsorshipTier: SponsorshipTier.GOLD,
          websiteUrl: 'https://example.org',
          city: 'Lagos',
          country: 'Nigeria',
        }),
      ]),
    );
    expect(el.textContent).toContain('Acme University');
    expect(el.textContent).toContain('Gold');
    expect(el.textContent).toContain('Lagos, Nigeria');
    expect(el.querySelector('a[href="/partners/acme-university"]')).not.toBeNull();
    expect(el.querySelector('a[href="https://example.org"]')?.getAttribute('rel')).toContain(
      'noopener',
    );
  });

  it('shows pagination when there is more than one page', async () => {
    const { el } = await render(page([fakePublicPartner()], 3));
    expect(el.textContent).toContain('Page 1 of 3');
  });

  it('searches public partners by keyword and type', async () => {
    const { fixture, el } = await render(page([fakePublicPartner()]));
    const type = el.querySelector<HTMLSelectElement>('select')!;
    type.value = 'NGO';
    type.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === `${api}/search` && r.params.get('partnerType') === 'NGO')
      .flush(page([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('No partners match your search');

    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'orange';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('keyword')).toBe('orange');
    expect(req.request.params.get('partnerType')).toBe('NGO');
    req.flush(page([fakePublicPartner()]));
  });
});
