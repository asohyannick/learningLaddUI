import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { coursePage } from '../../../core/testing/fake-course';
import { ok } from '../../../core/testing/fake-login-response';
import { fakePartner } from '../../../core/testing/fake-partner';
import { PartnerType } from '../partnership.model';
import { PartnerManager } from './partner-manager';

const api = `${environment.apiUrl}/partners`;
const listUrl = `${api}?page=0&size=20`;

async function formData(body: unknown): Promise<unknown> {
  return JSON.parse(await ((body as FormData).get('data') as Blob).text());
}

describe('PartnerManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerManager],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(PartnerManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(9));
    backend.expectOne(listUrl).flush(ok(coursePage([fakePartner()], 9)));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const submit = () =>
      el.querySelector('app-partner-form form')!.dispatchEvent(new Event('submit'));
    const reloadAfterSave = (content = [fakePartner()]) => {
      backend.expectOne(listUrl).flush(ok(coursePage(content, 9)));
      backend.expectOne(`${api}/count`).flush(ok(9));
    };
    return { fixture, el, notified, button, type, submit, reloadAfterSave };
  }

  it('lists partners with the total count, type, tier, amount and status', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-testid="partner-count"]')?.textContent?.trim()).toBe('9');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Orange Foundation');
    expect(row).toContain('Sponsor');
    expect(row).toContain('Gold');
    expect(row).toContain('USD 25,000.00');
    expect(row).toContain('Active');
    expect(row).toContain('Open-ended');
    for (const action of ['View', 'Edit', 'Delete']) {
      expect(el.querySelector(`button[aria-label="${action} Orange Foundation"]`)).not.toBeNull();
    }
  });

  it('filters and sorts on the search endpoint, then exports the matches', async () => {
    const { fixture, el, button } = await render();
    const [status, , tier, sort] = [...el.querySelectorAll('select')] as HTMLSelectElement[];
    status.value = 'PENDING';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === `${api}/search` && r.params.get('status') === 'PENDING')
      .flush(ok(coursePage([fakePartner()])));

    tier.value = 'GOLD';
    tier.dispatchEvent(new Event('change'));
    sort.value = '6';
    sort.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('sponsorshipTier')).toBe('GOLD');
    expect(req.request.params.get('sortBy')).toBe('agreementEndDate');
    expect(req.request.params.get('sortDirection')).toBe('ASC');
    req.flush(ok(coursePage([fakePartner()])));
    await fixture.whenStable();

    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    button('Download matches (PDF)')!.click();
    const pdf = backend.expectOne((r) => r.url === `${api}/download`);
    expect(pdf.request.params.get('status')).toBe('PENDING');
    expect(pdf.request.params.has('page')).toBe(false);
    pdf.flush(new Blob(['%PDF']));
    save.mockRestore();
  });

  it('shows the full staff view in the side panel, with a renewal warning', async () => {
    const { fixture, el } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="View Orange Foundation"]')!.click();
    fixture.detectChanges();
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    backend
      .expectOne(`${api}/pt-1`)
      .flush(ok(fakePartner({ agreementEndDate: soon, internalNotes: 'Renew in Q4' })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-partner')!;
    expect(panel.textContent).toContain('awa@orange.example.org');
    expect(panel.textContent).toContain('Renew in Q4');
    expect(panel.textContent).toContain('On the website');
    expect(panel.querySelector('[data-testid="agreement-notice"]')?.textContent).toMatch(
      /ends in 1\d day\(s\)/,
    );
  });

  it('adds a partner: sponsors need a tier, blank fields are left out', async () => {
    const { fixture, el, notified, button, type, submit, reloadAfterSave } = await render();
    button('Add partner')!.click();
    await fixture.whenStable();
    submit();
    fixture.detectChanges();
    expect(el.textContent).toContain('Name is required.');
    expect(el.textContent).toContain('Partner type is required.');

    type('pf-name', 'Orange Foundation');
    type('pf-partnerType', 'SPONSOR');
    type('pf-sponsorshipAmount', '25000.123');
    type('pf-agreementStartDate', '2026-06-01');
    type('pf-agreementEndDate', '2026-01-01');
    submit();
    fixture.detectChanges();
    expect(el.textContent).toContain('Sponsors need a sponsorship tier.');
    expect(el.textContent).toContain(
      'Sponsorship amount can have at most 12 digits and 2 decimals.',
    );
    expect(el.textContent).toContain('Agreement end cannot be before the start date.');
    expect(el.querySelector<HTMLInputElement>('#pf-slug')!.placeholder).toBe('orange-foundation');

    type('pf-sponsorshipTier', 'GOLD');
    type('pf-sponsorshipAmount', '25000');
    type('pf-sponsorshipCurrency', 'xaf');
    type('pf-agreementEndDate', '2027-05-31');
    submit();

    const req = backend.expectOne((r) => r.method === 'POST');
    expect(await formData(req.request.body)).toEqual({
      name: 'Orange Foundation',
      partnerType: 'SPONSOR',
      sponsorshipTier: 'GOLD',
      agreementStartDate: '2026-06-01',
      agreementEndDate: '2027-05-31',
      sponsorshipAmount: 25000,
      sponsorshipCurrency: 'XAF',
      showOnWebsite: true,
      featured: false,
    });
    req.flush(ok(fakePartner(), '"Orange Foundation" added as GOLD sponsor.'));
    reloadAfterSave();
    await fixture.whenStable();
    expect(el.querySelector('app-partner-form')).toBeNull();
    expect(notified).toEqual(['"Orange Foundation" added as GOLD sponsor.']);
  });

  it('edits only what changed and uses the remove flags to clear tier and end date', async () => {
    const { fixture, el, notified, type, submit, reloadAfterSave } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Orange Foundation"]')!.click();
    fixture.detectChanges();
    backend
      .expectOne(`${api}/pt-1`)
      .flush(
        ok(fakePartner({ partnerType: PartnerType.ACADEMIC, agreementEndDate: '2026-12-31' })),
      );
    await fixture.whenStable();

    expect(el.querySelector<HTMLInputElement>('#pf-name')!.value).toBe('Orange Foundation');
    type('pf-sponsorshipTier', '');
    type('pf-agreementEndDate', '');
    type('pf-status', 'INACTIVE');
    el.querySelector<HTMLInputElement>('#pf-featured')!.click();
    submit();

    const req = backend.expectOne((r) => r.method === 'PATCH');
    expect(await formData(req.request.body)).toEqual({
      featured: false,
      removeSponsorshipTier: true,
      removeAgreementEndDate: true,
      status: 'INACTIVE',
    });
    req.flush(ok(fakePartner(), '"Orange Foundation" is now INACTIVE'));
    reloadAfterSave();
    await fixture.whenStable();
    expect(notified).toEqual(['"Orange Foundation" is now INACTIVE']);
  });

  it('deletes a partner after confirming', async () => {
    const { fixture, el, notified, button, reloadAfterSave } = await render();
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Orange Foundation"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-partner')?.textContent).toContain('Orange Foundation');

    button('Delete partner')!.click();
    const req = backend.expectOne(`${api}/pt-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(ok(null, 'Partner deleted successfully'));
    reloadAfterSave([]);
    await fixture.whenStable();
    expect(notified).toEqual(['Partner deleted successfully']);
  });
});
