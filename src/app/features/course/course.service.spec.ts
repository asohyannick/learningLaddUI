import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptor/error.interceptor';
import { coursePage, fakeCourse, fakeCourseSummary } from '../../core/testing/fake-course';
import { ok } from '../../core/testing/fake-login-response';
import { CourseService, finalPrice } from './course.service';

const api = `${environment.apiUrl}/course`;

describe('CourseService', () => {
  let service: CourseService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CourseService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('lists courses with paging', () => {
    let total = 0;
    service.listCourses(2, 10).subscribe((page) => (total = page.totalElements));
    backend.expectOne(`${api}?page=2&size=10`).flush(ok(coursePage([fakeCourseSummary()], 21)));
    expect(total).toBe(21);
  });

  it('searches with only the filters that are set', () => {
    service
      .searchCourses({ search: '  algebra ', level: 'BEGINNER', category: '', published: false })
      .subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/search`);
    expect(req.request.params.keys()).toEqual(['search', 'level', 'published']);
    expect(req.request.params.get('search')).toBe('algebra');
    expect(req.request.params.get('published')).toBe('false');
    req.flush(ok(coursePage([])));
  });

  it('counts courses', () => {
    let count = -1;
    service.countCourses().subscribe((n) => (count = n));
    backend.expectOne(`${api}/count`).flush(ok(7));
    expect(count).toBe(7);
  });

  it('creates a course as multipart with a JSON data part and the idempotency key', async () => {
    const thumbnail = new File(['img'], 'cover.png', { type: 'image/png' });
    const material = new File(['pdf'], 'week-1.pdf', { type: 'application/pdf' });
    service
      .createCourse({ name: 'Algebra' }, { thumbnail, materials: [material] }, 'key-1')
      .subscribe();

    const req = backend.expectOne(api);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-1');
    const body = req.request.body as FormData;
    const data = body.get('data') as Blob;
    expect(data.type).toBe('application/json');
    expect(JSON.parse(await data.text())).toEqual({ name: 'Algebra' });
    expect((body.get('thumbnail') as File).name).toBe('cover.png');
    expect(body.getAll('materials')).toHaveLength(1);
    expect(body.has('syllabus')).toBe(false);
    req.flush(ok(fakeCourse(), 'Course created successfully'));
  });

  it('updates a course with PATCH', () => {
    service.updateCourse('c-1', { price: 20 }).subscribe();
    const req = backend.expectOne(`${api}/c-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush(ok(fakeCourse()));
  });

  it('deletes a course and returns the API message', () => {
    let message = '';
    service.deleteCourse('c-1').subscribe((m) => (message = m));
    const req = backend.expectOne(`${api}/c-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(ok(null, 'Course deleted successfully'));
    expect(message).toBe('Course deleted successfully');
  });

  it('downloads the PDF under the name from Content-Disposition', () => {
    URL.createObjectURL ??= () => '';
    URL.revokeObjectURL ??= () => undefined;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    let fileName = '';
    service.downloadCoursePdf('c-1', 'data-science').subscribe((name) => (fileName = name));
    const req = backend.expectOne(`${api}/c-1/pdf`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF'], { type: 'application/pdf' }), {
      headers: { 'Content-Disposition': 'attachment; filename="data-science-101.pdf"' },
    });

    expect(fileName).toBe('data-science-101.pdf');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });

  it('computes the price after the discount', () => {
    expect(finalPrice({ price: 50, discount: 10 })).toBe(40);
    expect(finalPrice({ price: 5, discount: 10 })).toBe(0);
  });
});
