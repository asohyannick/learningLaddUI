import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../enum/global-enum-configuration';
import { errorInterceptor } from '../../interceptor/error.interceptor';
import { fakeLoginResponse, ok } from '../../testing/fake-login-response';
import { fakeUser } from '../../testing/fake-user';
import { AuthService } from './auth.service';
import { UserAdminService, accountStatus, canBlock } from './user-admin.service';

const api = `${environment.apiUrl}/auth`;

describe('UserAdminService', () => {
  let service: UserAdminService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(UserAdminService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists users with the paging and sorting query', () => {
    let total = 0;
    service
      .listUsers({ page: 2, size: 10, sortBy: 'email', sortDirection: 'ASC' })
      .subscribe((page) => (total = page.totalElements));

    const req = backend.expectOne((r) => r.url === `${api}/users`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    expect(req.request.params.get('sortBy')).toBe('email');
    expect(req.request.params.get('sortDirection')).toBe('ASC');
    req.flush(ok({ content: [fakeUser()], totalElements: 31, totalPages: 4 }));
    expect(total).toBe(31);
  });

  it('fetches one user by id', () => {
    let email = '';
    service.getUser('u-9').subscribe((user) => (email = user.email));
    backend.expectOne(`${api}/users/u-9`).flush(ok(fakeUser({ id: 'u-9', email: 'x@y.z' })));
    expect(email).toBe('x@y.z');
  });

  it('blocks with a reason and remembers the change over the cached server data', () => {
    let message = '';
    service.blockUser('u-1', { reason: 'Spamming the forum' }).subscribe((m) => (message = m));

    const req = backend.expectOne(`${api}/users/u-1/block`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: 'Spamming the forum' });
    req.flush(ok(null, 'User account blocked'));

    expect(message).toBe('User account blocked');
    expect(service.withLocalChanges(fakeUser()).isAccountBlocked).toBe(true);
    expect(service.withLocalChanges(fakeUser({ id: 'other' })).isAccountBlocked).toBe(false);
  });

  it('unblocks with a reason', () => {
    service.unblockUser('u-1', { reason: 'Appeal accepted' }).subscribe();
    const req = backend.expectOne(`${api}/users/u-1/unblock`);
    expect(req.request.method).toBe('PATCH');
    req.flush(ok(null, 'User account unblocked'));
    expect(service.withLocalChanges(fakeUser({ isAccountBlocked: true })).isAccountBlocked).toBe(
      false,
    );
  });

  it('deletes the signed-in account with the password and ends the session', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(fakeLoginResponse({ id: 'me-1' }));

    auth.deleteAccount({ password: 'Secret#1', reason: null }).subscribe();
    const req = backend.expectOne((r) => r.url === `${api}/account`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('userId')).toBe('me-1');
    expect(req.request.body).toEqual({ password: 'Secret#1', reason: null });
    req.flush(ok(null, 'Account deleted'));

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('applies the server rules for who can be blocked', () => {
    expect(canBlock(fakeUser(), 'me')).toBe(true);
    expect(canBlock(fakeUser({ id: 'me' }), 'me')).toBe(false);
    expect(canBlock(fakeUser({ role: UserRole.SUPER_ADMIN }), 'me')).toBe(false);
    expect(accountStatus(fakeUser({ isAccountVerified: false }))).toBe('Unverified');
    expect(accountStatus(fakeUser({ isAccountBlocked: true }))).toBe('Blocked');
  });
});
