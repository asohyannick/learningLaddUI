import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { fakeCourse } from '../../../core/testing/fake-course';
import { ok } from '../../../core/testing/fake-login-response';
import { CourseForm } from './course-form';

const api = `${environment.apiUrl}/course`;

describe('CourseForm', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CourseForm],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function type(el: HTMLElement, selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function render(courseId: string | null = null) {
    const fixture = TestBed.createComponent(CourseForm);
    fixture.componentRef.setInput('courseId', courseId);
    const done: string[] = [];
    fixture.componentInstance.done.subscribe((m) => done.push(m));
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, done };
  }

  it('needs a name and a discount no higher than the price', async () => {
    const { fixture, el } = await render();
    type(el, '#course-price', '10');
    type(el, '#course-discount', '15');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(el.textContent).toContain('Course name is required.');
    expect(el.textContent).toContain('Discount cannot be more than the price.');
    backend.expectNone(api);
  });

  it('shows the API field errors next to the fields', async () => {
    const { fixture, el } = await render();
    type(el, '#course-name', 'Algebra');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    backend.expectOne(api).flush(
      {
        status: 400,
        message: 'Validation failed',
        errors: [{ field: 'name', message: 'A course with this name already exists' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(el.querySelector('app-form-alert')?.textContent).toContain('Validation failed');
    expect(el.textContent).toContain('A course with this name already exists');
  });

  it('loads the course to edit and only sends the fields that changed', async () => {
    const { fixture, el, done } = await render('c-1');
    backend.expectOne(`${api}/c-1`).flush(ok(fakeCourse({ price: 50, discount: 10 })));
    await fixture.whenStable();
    expect(el.querySelector<HTMLInputElement>('#course-name')!.value).toBe('Data Science 101');

    type(el, '#course-price', '30');
    type(el, '#course-category', '  Data  ');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne(`${api}/c-1`);
    expect(req.request.method).toBe('PATCH');
    const data = JSON.parse(await ((req.request.body as FormData).get('data') as Blob).text());
    expect(data).toEqual({ price: 30, category: 'Data' });
    req.flush(ok(fakeCourse(), 'Course updated successfully'));
    await fixture.whenStable();
    expect(done).toEqual(['Course updated successfully']);
  });

  it('does not send an update when nothing changed', async () => {
    const { fixture, el } = await render('c-1');
    backend.expectOne(`${api}/c-1`).flush(ok(fakeCourse()));
    await fixture.whenStable();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Nothing to save');
  });
});
