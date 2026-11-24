import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeJobListing, fakeJobSummary, jobPage } from '../../../core/testing/fake-job-listing';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { JobStatus } from '../job-listing.model';
import { JobListingManager } from './job-listing-manager';

const api = `${environment.apiUrl}/job-listing`;
const listUrl = `${api}?page=0&size=20`;

async function dataOf(req: TestRequest): Promise<unknown> {
  return JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
}

describe('JobListingManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobListingManager],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render() {
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'me', role: UserRole.SUPER_ADMIN }),
    );
    const fixture = TestBed.createComponent(JobListingManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(4));
    backend.expectOne(listUrl).flush(jobPage([fakeJobSummary({ status: JobStatus.DRAFT })], 4));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    };
    const submit = async () => {
      el.querySelector('app-job-listing-form form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    const reloadAfterSave = () => {
      backend.expectOne(listUrl).flush(jobPage([fakeJobSummary()], 4));
      backend.expectOne(`${api}/count`).flush(ok(4));
    };
    return { fixture, el, notified, button, set, submit, reloadAfterSave };
  }

  it('lists listings with the total, reference, type, deadline and status', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-testid="job-count"]')?.textContent?.trim()).toBe('4');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Lecturer in Mathematics');
    expect(row).toContain('JOB-2026-0042');
    expect(row).toContain('Full time');
    expect(row).toContain('31 Dec 2099');
    expect(row).toContain('Draft');
    for (const action of ['View', 'Edit', 'Delete']) {
      expect(
        el.querySelector(`button[aria-label="${action} Lecturer in Mathematics"]`),
      ).not.toBeNull();
    }
  });

  it('posts a job with a photo and publishes it straight away', async () => {
    const { fixture, el, notified, button, set, submit, reloadAfterSave } = await render();
    button('Post a job')!.click();
    await fixture.whenStable();

    set('jf-title', '  Librarian ');
    set('jf-salaryMin', '500');
    set('jf-salaryMax', '100');
    await submit();
    expect(el.textContent).toContain('Job description is required.');
    expect(el.textContent).toContain('Maximum salary cannot be less than the minimum.');

    set('jf-description', 'Run the library.');
    set('jf-salaryMax', '900');
    set('jf-skills', 'Cataloguing\n\n  Customer service ');
    set('jf-currency', 'xaf');
    const photo = new File(['x'], 'lib.png', { type: 'image/png' });
    const picker = el.querySelector<HTMLInputElement>('[data-testid="photo-input"]')!;
    Object.defineProperty(picker, 'files', { value: [photo] });
    picker.dispatchEvent(new Event('change'));
    el.querySelector<HTMLInputElement>('#jf-publishNow')!.click();
    await submit();

    const create = backend.expectOne(api);
    expect(create.request.method).toBe('POST');
    expect(await dataOf(create)).toEqual({
      title: 'Librarian',
      description: 'Run the library.',
      employmentType: 'FULL_TIME',
      workMode: 'ON_SITE',
      salaryPeriod: 'MONTHLY',
      salaryMin: 500,
      salaryMax: 900,
      currency: 'XAF',
      skills: ['Cataloguing', 'Customer service'],
      salaryVisible: true,
    });
    expect((create.request.body as FormData).get('photo')).toBe(photo);
    create.flush(ok(fakeJobListing({ id: 'job-9', title: 'Librarian', status: JobStatus.DRAFT })));

    const publish = backend.expectOne(`${api}/job-9`);
    expect(publish.request.method).toBe('PATCH');
    expect(await dataOf(publish)).toEqual({ status: 'OPEN' });
    publish.flush(ok(fakeJobListing({ id: 'job-9', title: 'Librarian' })));
    reloadAfterSave();
    await fixture.whenStable();
    expect(notified).toEqual(['“Librarian” was posted and is open for applications.']);
    expect(el.querySelector('app-job-listing-form')).toBeNull();
  });

  it('edits only what changed: closes the listing, clears a list and the requirements', async () => {
    const { fixture, el, notified, set, submit, reloadAfterSave } = await render();
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit Lecturer in Mathematics"]',
    )!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/job-1`).flush(ok(fakeJobListing()));
    await fixture.whenStable();

    set('jf-status', JobStatus.CLOSED);
    set('jf-benefits', '');
    set('jf-requirements', '');
    set('jf-salaryMax', ''); // numbers keep their value when cleared
    await submit();
    const update = backend.expectOne(`${api}/job-1`);
    expect(update.request.method).toBe('PATCH');
    expect(await dataOf(update)).toEqual({ status: 'CLOSED', benefits: [], requirements: '' });
    update.flush(ok(fakeJobListing({ status: JobStatus.CLOSED })));
    reloadAfterSave();
    await fixture.whenStable();
    expect(notified).toEqual(['Changes to “Lecturer in Mathematics” were saved.']);
  });

  it('publishes a draft from the panel, then deletes it', async () => {
    const { fixture, el, notified, button } = await render();
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="View Lecturer in Mathematics"]',
    )!.click();
    fixture.detectChanges();
    backend
      .expectOne(`${api}/job-1`)
      .flush(ok(fakeJobListing({ status: JobStatus.DRAFT, publishedAt: undefined })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-job-listing')!;
    expect(panel.textContent).toContain('XAF 250,000 – 400,000 / month');
    expect(panel.textContent).toContain('Calculus');
    expect(panel.textContent).toContain('not published yet');

    button('Publish: open for applications')!.click();
    const publish = backend.expectOne(`${api}/job-1`);
    expect(await dataOf(publish)).toEqual({ status: 'OPEN' });
    publish.flush(ok(fakeJobListing()));
    backend.expectOne(listUrl).flush(jobPage([fakeJobSummary()], 4));
    backend.expectOne(`${api}/count`).flush(ok(4));
    await fixture.whenStable();
    expect(button('Publish: open for applications')).toBeUndefined();

    [...panel.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Delete')!.click();
    await fixture.whenStable();
    button('Delete listing')!.click();
    backend.expectOne(`${api}/job-1`).flush(ok(null));
    backend.expectOne(listUrl).flush(jobPage([], 3));
    backend.expectOne(`${api}/count`).flush(ok(3));
    await fixture.whenStable();
    expect(notified).toEqual([
      '“Lecturer in Mathematics” is now open for applications.',
      '“Lecturer in Mathematics” was deleted.',
    ]);
    expect(el.querySelector('app-fetch-job-listing')).toBeNull();
  });
});
