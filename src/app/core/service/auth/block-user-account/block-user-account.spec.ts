import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { fakeUser } from '../../../testing/fake-user';
import { BlockUserAccount } from './block-user-account';

const url = `${environment.apiUrl}/auth/users/u-1/block`;

describe('BlockUserAccount', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockUserAccount],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render() {
    const fixture = TestBed.createComponent(BlockUserAccount);
    fixture.componentRef.setInput('user', fakeUser());
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (value: string) => {
      const input = el.querySelector<HTMLTextAreaElement>('#block-reason')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, type, submit };
  }

  it('needs a reason of at least 5 characters', async () => {
    const { el, type, submit } = await render();
    type('bad');
    await submit();
    expect(el.querySelector('#block-reason-error')?.textContent).toContain('at least 5');
    backend.expectNone(url);
  });

  it('blocks the user and emits the API message', async () => {
    const { fixture, type, submit } = await render();
    const done: string[] = [];
    fixture.componentInstance.done.subscribe((m) => done.push(m));

    type('  Repeated spam in the forum  ');
    await submit();
    const req = backend.expectOne(url);
    expect(req.request.body).toEqual({ reason: 'Repeated spam in the forum' });
    req.flush(ok(null, 'User account blocked'));
    expect(done).toEqual(['User account blocked']);
  });

  it('shows why the server refused', async () => {
    const { el, type, submit } = await render();
    type('Repeated spam');
    await submit();
    backend
      .expectOne(url)
      .flush(
        { success: false, status: 400, message: 'Super admin accounts cannot be blocked' },
        { status: 400, statusText: 'Bad Request' },
      );
    TestBed.tick();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('cannot be blocked');
  });
});
