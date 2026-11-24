import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { ok } from '../../../core/testing/fake-login-response';
import { fakePublicPartner } from '../../../core/testing/fake-partner';
import { PartnerPage } from './partner-page';

const api = `${environment.apiUrl}/partners/public`;

describe('PartnerPage', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnerPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function render(slug: string) {
    const fixture = TestBed.createComponent(PartnerPage);
    fixture.componentRef.setInput('slug', slug);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the partner from its slug and sets the page title', async () => {
    const { fixture, el } = render('orange-foundation');
    backend.expectOne(`${api}/orange-foundation`).flush(
      ok(
        fakePublicPartner({
          description: 'We fund labs.',
          benefits: 'Free data bundles for students.',
          linkedinUrl: 'https://linkedin.com/company/orange',
        }),
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('h1')?.textContent).toContain('Orange Foundation');
    expect(el.textContent).toContain('Gold sponsor');
    expect(el.textContent).toContain('Douala, Cameroon');
    expect(el.textContent).toContain('Free data bundles for students.');
    expect(el.querySelector('a[href="https://linkedin.com/company/orange"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Orange Foundation | Learning Ladder');
  });

  it('says when the partner is not listed', async () => {
    const { fixture, el } = render('gone');
    backend
      .expectOne(`${api}/gone`)
      .flush(
        { success: false, status: 404, message: 'Partner not found' },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Partner not found');
    expect(el.querySelector('a[href="/partners"]')).not.toBeNull();
  });
});
