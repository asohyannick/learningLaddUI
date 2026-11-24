import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CourseSummary } from '../../core/interface';
import { AuthService } from '../../core/service/auth/auth.service';
import { fakePublicPartner } from '../../core/testing/fake-partner';
import { Home } from './home';

const api = environment.apiUrl;
const partnersUrl = `${api}/partners/public?page=0&size=100`;
const coursesUrl = `${api}/course/search?published=true&page=0&size=6&sortBy=createdAt&sortDirection=desc`;

function page<T>(content: T[]) {
  return {
    success: true,
    status: 200,
    message: 'OK',
    data: {
      content,
      page: 0,
      size: content.length,
      totalElements: content.length,
      totalPages: 1,
      first: true,
      last: true,
    },
    path: '',
    timestamp: '',
  };
}

const course = {
  id: 'c1',
  name: 'Data Science 101',
  shortDescription: 'Learn the basics of data.',
  category: 'Technology',
  level: 'ALL_LEVELS',
  price: 50,
  discount: 10,
  currency: 'USD',
  thumbnailUrl: null,
} as CourseSummary;

const partner = fakePublicPartner({ name: 'Acme University' });

describe('Home', () => {
  const isAuthenticated = signal(false);
  let backend: HttpTestingController;

  function render() {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(async () => {
    isAuthenticated.set(false);
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated, dashboardPath: signal('/dashboard/student') },
        },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('links the main calls to action to their pages', async () => {
    const { fixture, el } = render();
    backend.expectOne(partnersUrl).flush(page([]));
    await fixture.whenStable();
    const hrefs = Array.from(el.querySelectorAll('a[href]'), (a) => a.getAttribute('href'));
    for (const path of ['/register', '/courses', '/partners', '/jobs']) {
      expect(hrefs).toContain(path);
    }
    expect(hrefs).toContain('/#platform');
  });

  it('asks guests to sign in instead of calling the course API', async () => {
    const { fixture, el } = render();
    backend.expectOne(partnersUrl).flush(page([]));
    await fixture.whenStable();
    backend.expectNone(coursesUrl);
    expect(el.textContent).toContain('Sign in to explore the catalogue');
  });

  it('shows featured courses with the discounted price for signed-in users', async () => {
    isAuthenticated.set(true);
    const { fixture, el } = render();
    backend.expectOne(partnersUrl).flush(page([]));
    backend.expectOne(coursesUrl).flush(page([course]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Data Science 101');
    expect(el.textContent).toContain('All levels');
    expect(el.textContent).toContain('$40.00');
    expect(el.querySelector('s')?.textContent).toContain('$50.00');
  });

  it('shows every public partner in the moving carousel, only when there are some', async () => {
    const { fixture, el } = render();
    expect(el.querySelector('#partners-heading')).toBeNull();
    backend
      .expectOne(partnersUrl)
      .flush(page([partner, fakePublicPartner({ id: 'p2', name: 'City Council', slug: 'city' })]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('#partners-heading')).not.toBeNull();
    expect(el.textContent).toContain('Climbing together with 2 organisations');
    const carousel = el.querySelector('app-partner-carousel')!;
    expect(carousel.textContent).toContain('Acme University');
    expect(carousel.textContent).toContain('City Council');
    expect(carousel.querySelector('a[href="/partners/city"]')).not.toBeNull();
  });
});
