import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeUser } from '../../../core/testing/fake-user';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { AdminDashboard } from './admin-dashboard';

const api = `${environment.apiUrl}/auth/users`;

describe('AdminDashboard', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'me', firstName: 'Ngozi', role: UserRole.ADMIN }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  async function render() {
    const fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === api)
      .flush(
        ok({
          content: [fakeUser({ id: 'u-1', firstName: 'Ada' })],
          totalElements: 1,
          totalPages: 1,
        }),
      );
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('greets the admin, lists users and links to sign out', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('Welcome back, Ngozi');
    expect(el.querySelector('tbody')?.textContent).toContain('Ada Ade');
    expect(el.querySelector('a[href="/logout"]')).not.toBeNull();
  });

  it('opens the user panel, then the block dialog, and confirms with a toast', async () => {
    const { fixture, el } = await render();

    el.querySelector<HTMLButtonElement>('button[aria-label="View Ada Ade"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/u-1`).flush(ok(fakeUser({ id: 'u-1', firstName: 'Ada' })));
    await fixture.whenStable();
    expect(el.querySelector('app-fetch-user')?.textContent).toContain('User details');

    el.querySelector<HTMLButtonElement>('app-fetch-user footer button')!.click();
    await fixture.whenStable();
    const reason = el.querySelector<HTMLTextAreaElement>('#block-reason')!;
    reason.value = 'Repeated spam';
    reason.dispatchEvent(new Event('input'));
    el.querySelector('app-block-user-account form')!.dispatchEvent(new Event('submit'));
    backend.expectOne(`${api}/u-1/block`).flush(ok(null, 'User account blocked'));
    await fixture.whenStable();

    expect(el.querySelector('app-block-user-account')).toBeNull();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('User account blocked');
    expect(el.querySelector('tbody')?.textContent).toContain('Blocked');
  });

  it('opens the delete-account dialog from the sidebar', async () => {
    const { fixture, el } = await render();
    const button = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Delete my account'),
    )!;
    button.click();
    await fixture.whenStable();
    expect(el.querySelector('app-delete-user-account #delete-password')).not.toBeNull();
  });
});
