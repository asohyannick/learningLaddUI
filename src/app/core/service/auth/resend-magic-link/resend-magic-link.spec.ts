import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { ResendMagicLink } from './resend-magic-link';

const url = `${environment.apiUrl}/auth/magic-link/resend`;

describe('ResendMagicLink', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [ResendMagicLink],
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
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(ResendMagicLink);
    fixture.componentRef.setInput('email', 'ada@example.com');
    fixture.detectChanges();
    const button = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!;
    return { fixture, button };
  }

  it('waits out the 60-second cooldown, then sends a new link', () => {
    const { fixture, button } = render();
    const resent: string[] = [];
    fixture.componentInstance.resent.subscribe((m) => resent.push(m));
    expect(button().disabled).toBe(true);

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(button().disabled).toBe(false);
    expect(button().textContent).toContain('Send another link');

    button().click();
    const req = backend.expectOne(url);
    expect(req.request.body).toEqual({ email: 'ada@example.com' });
    req.flush(ok(null, 'New magic link sent'));
    fixture.detectChanges();

    expect(resent).toEqual(['New magic link sent']);
    expect(button().disabled).toBe(true);
  });

  it('shows the cooldown error from the API', () => {
    const { fixture, button } = render();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    button().click();
    backend
      .expectOne(url)
      .flush(
        { message: 'Please wait before requesting another link', status: 400 },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('Please wait');
  });
});
