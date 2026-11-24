import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { coursePage } from '../../core/testing/fake-course';
import { ok } from '../../core/testing/fake-login-response';
import { fakePartner, fakePublicPartner } from '../../core/testing/fake-partner';
import { PartnerStatus, PartnerType, SponsorshipTier, slugify } from './partnership.model';
import { PartnershipService, partnerInitials, sponsorshipLabel } from './partnership.service';

const api = `${environment.apiUrl}/partners`;

describe('PartnershipService', () => {
  let service: PartnershipService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnershipService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists, counts and fetches partners for staff', () => {
    let total = 0;
    service.listPartners(1, 50).subscribe();
    service.countPartners().subscribe((count) => (total = count));
    service.getPartner('pt-1').subscribe();
    backend.expectOne(`${api}?page=1&size=50`).flush(ok(coursePage([fakePartner()])));
    backend.expectOne(`${api}/count`).flush(ok(7));
    backend.expectOne(`${api}/pt-1`).flush(ok(fakePartner()));
    expect(total).toBe(7);
  });

  it('sends search filters and leaves out empty ones', () => {
    service
      .searchPartners({
        keyword: ' orange ',
        partnerType: PartnerType.SPONSOR,
        sponsorshipTier: SponsorshipTier.GOLD,
        status: PartnerStatus.ACTIVE,
        featured: false,
        industry: '',
        agreementEndTo: '2026-12-31',
        page: 0,
        size: 20,
        sortBy: 'agreementEndDate',
        sortDirection: 'ASC',
      })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    const params = req.request.params;
    expect(params.get('keyword')).toBe('orange');
    expect(params.get('featured')).toBe('false');
    expect(params.get('agreementEndTo')).toBe('2026-12-31');
    expect(params.get('sortBy')).toBe('agreementEndDate');
    expect(params.has('industry')).toBe(false);
    req.flush(ok(coursePage([])));
  });

  it('creates and updates with a JSON data part plus logo and banner', async () => {
    const logo = new File(['x'], 'logo.png', { type: 'image/png' });
    const banner = new File(['y'], 'banner.jpg', { type: 'image/jpeg' });
    service
      .createPartner({ name: 'Orange', partnerType: PartnerType.CORPORATE }, { logo, banner })
      .subscribe();
    const create = backend.expectOne(api);
    expect(create.request.method).toBe('POST');
    const body = create.request.body as FormData;
    expect((body.get('data') as Blob).type).toBe('application/json');
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      name: 'Orange',
      partnerType: 'CORPORATE',
    });
    expect((body.get('logo') as File).name).toBe('logo.png');
    expect((body.get('banner') as File).name).toBe('banner.jpg');
    create.flush(ok(fakePartner()));

    service.updatePartner('pt-1', { removeSponsorshipTier: true }).subscribe();
    const update = backend.expectOne(`${api}/pt-1`);
    expect(update.request.method).toBe('PATCH');
    expect((update.request.body as FormData).has('logo')).toBe(false);
    update.flush(ok(fakePartner()));
  });

  it('deletes and emits the API message', () => {
    let message = '';
    service.deletePartner('pt-1').subscribe((m) => (message = m));
    backend.expectOne(`${api}/pt-1`).flush(ok(null, 'Partner deleted successfully'));
    expect(message).toBe('Partner deleted successfully');
  });

  it('downloads the PDF with filters but without paging', () => {
    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let name = '';
    service
      .downloadPartnersPdf({ status: PartnerStatus.ACTIVE, page: 2, size: 10 })
      .subscribe((n) => (name = n));
    const req = backend.expectOne((r) => r.url === `${api}/download`);
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.has('page')).toBe(false);
    expect(req.request.params.has('size')).toBe(false);
    req.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="partners-2026-11-24.pdf"' },
    });
    expect(name).toBe('partners-2026-11-24.pdf');
    save.mockRestore();
  });

  it('loads every public page for the carousel', () => {
    let names: string[] = [];
    service.getAllPublicPartners().subscribe((list) => (names = list.map((p) => p.name)));
    backend
      .expectOne(`${api}/public?page=0&size=100`)
      .flush(ok({ ...coursePage([fakePublicPartner({ name: 'A' })]), totalPages: 2 }));
    backend
      .expectOne(`${api}/public?page=1&size=100`)
      .flush(ok(coursePage([fakePublicPartner({ id: 'b', name: 'B' })])));
    expect(names).toEqual(['A', 'B']);
  });

  it('searches public partners without staff-only filters and fetches by slug', () => {
    service
      .searchPublicPartners({ keyword: 'tel', sponsorsOnly: true, status: PartnerStatus.PENDING })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/public/search`);
    expect(req.request.params.get('sponsorsOnly')).toBe('true');
    expect(req.request.params.has('status')).toBe(false);
    req.flush(ok(coursePage([])));

    service.getPublicPartner('orange-foundation').subscribe();
    backend.expectOne(`${api}/public/orange-foundation`).flush(ok(fakePublicPartner()));
  });

  it('formats names, amounts and slugs like the backend', () => {
    expect(partnerInitials('Orange Foundation')).toBe('OF');
    expect(partnerInitials('UNICEF')).toBe('UN');
    expect(sponsorshipLabel({ sponsorshipAmount: 25000, sponsorshipCurrency: 'usd' })).toBe(
      'USD 25,000.00',
    );
    expect(sponsorshipLabel({})).toBeNull();
    expect(slugify('  Université de Douala & Co. ')).toBe('universite-de-douala-co');
  });
});
