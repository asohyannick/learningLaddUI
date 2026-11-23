import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { coursePage, fakeCourse, fakeCourseSummary } from '../../../core/testing/fake-course';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { CourseManager } from './course-manager';

const api = `${environment.apiUrl}/course`;
const listUrl = `${api}?page=0&size=20`;

describe('CourseManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseManager],
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

  async function render(role: UserRole) {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ role }));
    const fixture = TestBed.createComponent(CourseManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/count`).flush(ok(12));
    backend
      .expectOne(listUrl)
      .flush(ok(coursePage([fakeCourseSummary({ id: 'c-1', name: 'Data Science 101' })], 12)));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    return { fixture, el, notified, button };
  }

  it('lists courses with the total count; lecturers can create and edit but not delete', async () => {
    const { el, button } = await render(UserRole.LECTURER);
    expect(el.querySelector('[data-testid="course-count"]')?.textContent?.trim()).toBe('12');
    expect(el.querySelector('tbody')?.textContent).toContain('Data Science 101');
    expect(el.querySelector('tbody')?.textContent).toContain('$40.00');
    expect(button('New course')).toBeDefined();
    expect(el.querySelector('button[aria-label="Edit Data Science 101"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="Delete Data Science 101"]')).toBeNull();
  });

  it('is read-only for roles the API does not let write', async () => {
    const { el, button } = await render(UserRole.IT_ADMIN);
    expect(button('New course')).toBeUndefined();
    expect(el.querySelector('button[aria-label="Edit Data Science 101"]')).toBeNull();
    expect(
      el.querySelector('button[aria-label="Download Data Science 101 as PDF"]'),
    ).not.toBeNull();
  });

  it('switches to the search endpoint when the user types a keyword', async () => {
    const { fixture, el } = await render(UserRole.PROFESSOR);
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'algebra';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();

    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.get('search')).toBe('algebra');
    expect(req.request.params.get('sortBy')).toBe('createdAt');
    req.flush(ok(coursePage([])));
    await fixture.whenStable();
    expect(el.querySelector('tbody')?.textContent).toContain('No courses match your search');
  });

  it('opens a course in the side panel', async () => {
    const { fixture, el } = await render(UserRole.PROFESSOR);
    el.querySelector<HTMLButtonElement>('button[aria-label="View Data Science 101"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/c-1`).flush(ok(fakeCourse({ description: 'All about data.' })));
    await fixture.whenStable();
    const panel = el.querySelector('app-fetch-course')!;
    expect(panel.textContent).toContain('All about data.');
    expect(panel.textContent).toContain('Download PDF');
  });

  it('plays the promo video and video materials from their signed links', async () => {
    const { fixture, el } = await render(UserRole.STUDENT);
    el.querySelector<HTMLButtonElement>('button[aria-label="View Data Science 101"]')!.click();
    fixture.detectChanges();
    const videoUrl = 'https://s3.example.com/videos/promo.mp4?X-Amz-Signature=abc';
    backend.expectOne(`${api}/c-1`).flush(
      ok(
        fakeCourse({
          promoVideoUrl: videoUrl,
          materials: [
            {
              id: 'm-1',
              fileName: 'lesson-1.mp4',
              url: 'https://s3.example.com/videos/lesson-1.mp4?sig=1',
              contentType: 'video/mp4',
              sizeBytes: 2048,
            } as never,
          ],
        }),
      ),
    );
    await fixture.whenStable();
    const video = el.querySelector<HTMLVideoElement>('[data-testid="promo-video"]')!;
    expect(video.getAttribute('src')).toBe(videoUrl);
    expect(el.querySelectorAll('app-fetch-course video')).toHaveLength(2);

    video.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="promo-video"]')).toBeNull();
    expect(el.querySelector('app-fetch-course')?.textContent).toContain(
      'The promo video could not be played',
    );
  });

  it('creates a course, reloads the list and reports success', async () => {
    const { fixture, el, notified, button } = await render(UserRole.LECTURER);
    button('New course')!.click();
    await fixture.whenStable();

    const name = el.querySelector<HTMLInputElement>('#course-name')!;
    name.value = 'Linear Algebra';
    name.dispatchEvent(new Event('input'));
    el.querySelector('app-course-form form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ name: 'Linear Algebra', currency: 'USD', published: false });
    req.flush(ok(fakeCourse({ name: 'Linear Algebra' }), 'Course created successfully'));

    backend.expectOne(listUrl).flush(ok(coursePage([fakeCourseSummary()], 13)));
    backend.expectOne(`${api}/count`).flush(ok(13));
    await fixture.whenStable();
    expect(el.querySelector('app-course-form')).toBeNull();
    expect(notified).toEqual(['Course created successfully']);
  });

  it('lets admins delete a course after confirming', async () => {
    const { fixture, el, notified, button } = await render(UserRole.ADMIN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Delete Data Science 101"]')!.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-course')?.textContent).toContain('Data Science 101');

    button('Delete course')!.click();
    const req = backend.expectOne(`${api}/c-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(ok(null, 'Course deleted successfully'));

    backend.expectOne(listUrl).flush(ok(coursePage([])));
    backend.expectOne(`${api}/count`).flush(ok(11));
    await fixture.whenStable();
    expect(el.querySelector('app-delete-course')).toBeNull();
    expect(notified).toEqual(['Course deleted successfully']);
  });
});
