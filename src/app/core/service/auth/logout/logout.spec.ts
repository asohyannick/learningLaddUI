import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { fakeLoginResponse, ok } from '../../../testing/fake-login-response';
import { AuthService } from '../auth.service';
import { Logout } from './logout';

describe('Logout', () => {
  it('revokes the session, then shows the login page', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Logout],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    const auth = TestBed.inject(AuthService);
    const backend = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.startSession(fakeLoginResponse());

    const fixture = TestBed.createComponent(Logout);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Signing you out');

    const req = backend.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush(ok(null, 'Logged out'));

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { signedOut: 'true' },
      replaceUrl: true,
    });
    backend.verify();
  });
});
