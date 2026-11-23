import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptor/error.interceptor';
import { AuthService } from '../../core/service/auth/auth.service';
import { coursePage, fakeCourse, fakeCourseSummary } from '../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../core/testing/fake-login-response';
import { Course } from './course';

const search = `${environment.apiUrl}/course/search`;

describe('Course catalogue', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Course],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(fakeLoginResponse());
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render(courseId?: string) {
    const fixture = TestBed.createComponent(Course);
    if (courseId) fixture.componentRef.setInput('course', courseId);
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === search);
    req.flush(
      ok(
        coursePage(
          [
            fakeCourseSummary({ id: 'c-1', name: 'Rust Mastery' }),
            fakeCourseSummary({ id: 'c-2', name: 'Java for backend devs', price: 0, discount: 0 }),
          ],
          2,
        ),
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, req };
  }

  it('fetches every published course, newest first, and shows them as cards', async () => {
    const { el, req } = await render();
    expect(req.request.params.get('published')).toBe('true');
    expect(req.request.params.get('sortBy')).toBe('publishedAt');
    expect(req.request.params.get('size')).toBe('12');

    const cards = el.querySelectorAll('app-course-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Rust Mastery');
    expect(cards[0].textContent).toContain('$40.00');
    expect(cards[1].textContent).toContain('Free');
    expect(el.querySelector('[data-testid="catalogue-summary"]')?.textContent).toContain(
      '2 courses',
    );
    expect(cards[0].querySelector('h3 a')?.getAttribute('href')).toBe('/courses?course=c-1');
  });

  it('filters by price and level', async () => {
    const { fixture, el } = await render();
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Free')!.click();
    fixture.detectChanges();
    const free = backend.expectOne((r) => r.url === search);
    expect(free.request.params.get('status')).toBe('FREE');
    free.flush(ok(coursePage([])));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('No courses match your search.');

    const level = el.querySelector('select') as HTMLSelectElement;
    level.value = 'ADVANCED';
    level.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const advanced = backend.expectOne((r) => r.url === search);
    expect(advanced.request.params.get('level')).toBe('ADVANCED');
    expect(advanced.request.params.get('status')).toBe('FREE');
    advanced.flush(ok(coursePage([])));
  });

  it('opens the course named in ?course= with its details', async () => {
    const { fixture, el } = await render('c-1');
    backend
      .expectOne(`${environment.apiUrl}/course/c-1`)
      .flush(ok(fakeCourse({ description: 'Ownership and lifetimes.' })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-course')!;
    expect(panel.textContent).toContain('Ownership and lifetimes.');
    expect(panel.textContent).not.toContain('Edit course');
  });
});
