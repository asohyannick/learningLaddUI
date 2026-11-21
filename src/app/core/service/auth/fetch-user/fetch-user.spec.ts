import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { UserAdminService } from '../user-admin.service';
import { fakeUser } from '../../../testing/fake-user';
import { FetchUser } from './fetch-user';

const api = `${environment.apiUrl}/auth/users`;

describe('FetchUser', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FetchUser],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render(userId = 'u-1') {
    const fixture = TestBed.createComponent(FetchUser);
    fixture.componentRef.setInput('userId', userId);
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('loads the user and shows their details', async () => {
    const { fixture, el } = await render();
    backend.expectOne(`${api}/u-1`).flush(ok(fakeUser({ firstName: 'Ada', lastName: 'Obi' })));
    await fixture.whenStable();
    expect(el.textContent).toContain('Ada Obi');
    expect(el.textContent).toContain('bola@example.com');
    expect(el.textContent).toContain('Student');
    expect(el.textContent).toContain('Active');
  });

  it('switches to "Unblock" once the user is blocked here', async () => {
    const { fixture, el } = await render();
    backend.expectOne(`${api}/u-1`).flush(ok(fakeUser()));
    await fixture.whenStable();

    TestBed.inject(UserAdminService).blockUser('u-1', { reason: 'Spam posts' }).subscribe();
    backend.expectOne(`${api}/u-1/block`).flush(ok(null));
    await fixture.whenStable();

    expect(el.textContent).toContain('Blocked');
    expect(el.querySelector('footer')?.textContent).toContain('Unblock account');
  });

  it('shows the error from the API', async () => {
    const { fixture, el } = await render('missing');
    backend
      .expectOne(`${api}/missing`)
      .flush(
        { success: false, status: 400, message: 'User not found', errorCode: 'BAD_REQUEST' },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('User not found');
  });
});
