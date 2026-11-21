import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { errorInterceptor } from '../../../interceptor/error.interceptor';
import { ok } from '../../../testing/fake-login-response';
import { fakeUser } from '../../../testing/fake-user';
import { UnBlockUserAccount } from './un-block-user-account';

const url = `${environment.apiUrl}/auth/users/u-1/unblock`;

describe('UnBlockUserAccount', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnBlockUserAccount],
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('unblocks the user with the reason and emits the API message', async () => {
    const fixture = TestBed.createComponent(UnBlockUserAccount);
    fixture.componentRef.setInput('user', fakeUser({ isAccountBlocked: true }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const done: string[] = [];
    fixture.componentInstance.done.subscribe((m) => done.push(m));

    const input = el.querySelector<HTMLTextAreaElement>('#unblock-reason')!;
    input.value = 'Appeal accepted';
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const req = backend.expectOne(url);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: 'Appeal accepted' });
    req.flush(ok(null, 'User account unblocked'));
    expect(done).toEqual(['User account unblocked']);
  });

  it('does not send an empty reason', async () => {
    const fixture = TestBed.createComponent(UnBlockUserAccount);
    fixture.componentRef.setInput('user', fakeUser({ isAccountBlocked: true }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.querySelector('#unblock-reason-error')?.textContent).toContain('Reason is required');
    backend.expectNone(url);
  });
});
