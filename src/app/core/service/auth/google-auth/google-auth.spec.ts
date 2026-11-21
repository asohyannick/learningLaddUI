import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { UserRole } from '../../../enum/global-enum-configuration';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { fakeLoginResponse, ok } from '../../../testing/fake-login-response';
import { FirebaseGoogleSignIn, isFirebaseConfigured } from './firebase-google-sign-in';
import { GoogleAuth } from './google-auth';

const url = `${environment.apiUrl}/auth/google`;

describe('GoogleAuth', () => {
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  const google = {
    configured: true,
    prepare: vi.fn(() => Promise.resolve()),
    signIn: vi.fn<() => Promise<string>>(),
  };

  beforeEach(async () => {
    localStorage.clear();
    google.signIn.mockReset();
    await TestBed.configureTestingModule({
      imports: [GoogleAuth],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: FirebaseGoogleSignIn, useValue: google },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => backend.verify());

  async function clickButton() {
    const fixture = TestBed.createComponent(GoogleAuth);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('button')!.click();
    await fixture.whenStable();
    return { fixture, el };
  }

  it('swaps the Firebase ID token for a session and opens the dashboard', async () => {
    google.signIn.mockResolvedValue('firebase-id-token');
    const { fixture } = await clickButton();

    const req = backend.expectOne(url);
    expect(req.request.body).toEqual({ idToken: 'firebase-id-token' });
    req.flush(ok(fakeLoginResponse({ role: UserRole.LIBRARIAN })));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/dashboard/librarian', { replaceUrl: true });
  });

  it('stays quiet when the user closes the Google window', async () => {
    google.signIn.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const { el } = await clickButton();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    backend.expectNone(url);
  });

  it('explains a blocked pop-up in red', async () => {
    google.signIn.mockRejectedValue({ code: 'auth/popup-blocked' });
    const { el } = await clickButton();
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Allow pop-ups');
    expect(alert?.className).toContain('text-red-600');
  });

  it('shows the backend error when the account is refused', async () => {
    google.signIn.mockResolvedValue('firebase-id-token');
    const { fixture, el } = await clickButton();
    backend.expectOne(url).flush(
      {
        success: false,
        status: 400,
        error: 'Bad Request',
        errorCode: 'BAD_REQUEST',
        message: 'This account has been blocked.',
        path: '',
        timestamp: '',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('has been blocked');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('treats template placeholders as "not configured"', () => {
    const placeholder = {
      apiKey: '<firebase-web-api-key>',
      authDomain: '<project>.firebaseapp.com',
      projectId: '<project-id>',
      appId: '<app-id>',
    };
    expect(isFirebaseConfigured(placeholder)).toBe(false);
    expect(isFirebaseConfigured({ apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' })).toBe(
      true,
    );
  });
});
