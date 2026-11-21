import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { UserRole } from '../../../enum/global-enum-configuration';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { IUserResponse } from '../../../interface';
import { ok } from '../../../testing/fake-login-response';
import { fakeUser } from '../../../testing/fake-user';
import { FetchAllUsers } from './fetch-all-users';

const url = `${environment.apiUrl}/auth/users`;

describe('FetchAllUsers', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FetchAllUsers],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  async function render(users: IUserResponse[], totalPages = 1) {
    const fixture = TestBed.createComponent(FetchAllUsers);
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === url)
      .flush(ok({ content: users, totalElements: users.length + 40, totalPages }));
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows each user with their status and the total', async () => {
    const { el } = await render([
      fakeUser({ id: 'a', firstName: 'Ada', lastName: 'Obi' }),
      fakeUser({ id: 'b', firstName: 'Femi', isAccountBlocked: true }),
    ]);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Ada Obi');
    expect(rows[0].textContent).toContain('Active');
    expect(rows[1].textContent).toContain('Blocked');
    expect(rows[1].querySelector('button[aria-label^="Unblock"]')).not.toBeNull();
    expect(el.textContent).toContain('42');
  });

  it('disables blocking for yourself and for super admins', async () => {
    const { el } = await render([
      fakeUser({ id: 'me', firstName: 'Me' }),
      fakeUser({ id: 's', firstName: 'Sam', role: UserRole.SUPER_ADMIN }),
    ]);
    const buttons = el.querySelectorAll<HTMLButtonElement>('button[aria-label^="Block"]');
    expect([...buttons].every((b) => b.disabled)).toBe(true);
  });

  it('emits the user to view or block', async () => {
    const { fixture, el } = await render([fakeUser({ id: 'a', firstName: 'Ada' })]);
    const viewed: string[] = [];
    const blocked: string[] = [];
    fixture.componentInstance.view.subscribe((u) => viewed.push(u.id));
    fixture.componentInstance.block.subscribe((u) => blocked.push(u.id));

    el.querySelector<HTMLButtonElement>('button[aria-label="View Ada Ade"]')!.click();
    el.querySelector<HTMLButtonElement>('button[aria-label="Block Ada Ade"]')!.click();
    expect(viewed).toEqual(['a']);
    expect(blocked).toEqual(['a']);
  });

  it('requests the next page', async () => {
    const { fixture, el } = await render([fakeUser()], 3);
    const next = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Next')!;
    next.click();
    fixture.detectChanges();
    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(ok({ content: [], totalElements: 41, totalPages: 3 }));
  });

  it('shows the API error with a retry', async () => {
    const fixture = TestBed.createComponent(FetchAllUsers);
    fixture.detectChanges();
    backend
      .expectOne((r) => r.url === url)
      .flush(
        { success: false, status: 403, message: 'Access denied', errorCode: 'ACCESS_DENIED' },
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('Access denied');
  });
});
