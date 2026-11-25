import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeLoan, libraryPage } from '../../../core/testing/fake-library';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { LoanStatus } from '../library.model';
import { LoanManager } from './loan-manager';

const api = `${environment.apiUrl}/library/loans`;

describe('LoanManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem('ll.studentProfileId.me');
    await TestBed.configureTestingModule({
      imports: [LoanManager],
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
    TestBed.inject(AuthService).endSession();
    localStorage.removeItem('ll.studentProfileId.me');
  });

  function setup(role: UserRole, mode: 'staff' | 'student') {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'me', role }));
    const fixture = TestBed.createComponent(LoanManager);
    fixture.componentRef.setInput('mode', mode);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
      );
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event(input.type === 'date' ? 'change' : 'input'));
    };
    return { fixture, el, notified, button, set };
  }

  it('shows librarians every loan with the count and the actions its status allows', async () => {
    const { fixture, el, notified, button, set } = setup(UserRole.LIBRARIAN, 'staff');
    backend.expectOne(`${api}/count`).flush(ok(4));
    backend.expectOne(`${api}?page=0&size=20`).flush(libraryPage([fakeLoan()], 1));
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="loan-count"]')?.textContent?.trim()).toBe('4');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('LN-2026-0007');
    expect(row).toContain('Pick up by 26 Nov 2026');
    expect(button('Issue LN-2026-0007')).toBeDefined();
    expect(button('Cancel reservation LN-2026-0007')).toBeDefined();

    button('Issue LN-2026-0007')!.click();
    await fixture.whenStable();
    set('la-condition', 'Good');
    set('la-due', '2099-12-31');
    el.querySelector('app-loan-action form')!.dispatchEvent(new Event('submit'));
    const issue = backend.expectOne(`${api}/loan-1/issue`);
    expect(issue.request.body.conditionOnBorrow).toBe('Good');
    expect(new Date(issue.request.body.dueAt).getFullYear()).toBe(2099);
    issue.flush({ ...ok(fakeLoan({ status: LoanStatus.BORROWED })), message: 'Issued.' });
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(libraryPage([fakeLoan({ status: LoanStatus.BORROWED })], 1));
    backend.expectOne(`${api}/count`).flush(ok(5));
    await fixture.whenStable();
    expect(notified).toEqual(['Issued.']);
    expect(button('Confirm return LN-2026-0007')).toBeDefined();
  });

  it('confirms a return with a waived fee, and refuses an empty condition', async () => {
    const { fixture, el, notified, button, set } = setup(UserRole.ADMIN, 'staff');
    backend.expectOne(`${api}/count`).flush(ok(1));
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(
        libraryPage([
          fakeLoan({ status: LoanStatus.RETURN_REQUESTED, lateFee: 3, feeCurrency: 'USD' }),
        ]),
      );
    await fixture.whenStable();
    button('Confirm return LN-2026-0007')!.click();
    await fixture.whenStable();
    el.querySelector('app-loan-action form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Describe the condition of the returned copy.');
    backend.expectNone(`${api}/loan-1/confirm-return`);

    set('la-condition', 'Fine');
    el.querySelector<HTMLInputElement>('#la-fee-waive')!.click();
    el.querySelector('app-loan-action form')!.dispatchEvent(new Event('submit'));
    const confirm = backend.expectOne(`${api}/loan-1/confirm-return`);
    expect(confirm.request.body).toEqual({ conditionOnReturn: 'Fine', waiveLateFee: true });
    confirm.flush({ ...ok(fakeLoan({ status: LoanStatus.RETURNED })), message: 'Returned.' });
    backend
      .expectOne(`${api}?page=0&size=20`)
      .flush(libraryPage([fakeLoan({ status: LoanStatus.RETURNED })]));
    backend.expectOne(`${api}/count`).flush(ok(0));
    await fixture.whenStable();
    expect(notified).toEqual(['Returned.']);
    expect(button('Delete LN-2026-0007')).toBeDefined();
  });

  it('asks students without a known profile to borrow first', async () => {
    const { fixture, el } = setup(UserRole.STUDENT, 'student');
    await fixture.whenStable();
    expect(el.textContent).toContain('No loans to show yet');
    backend.expectNone((r) => r.url.startsWith(api));
  });

  it("lists a student's own loans and lets them renew and return", async () => {
    localStorage.setItem('ll.studentProfileId.me', 'sp-1');
    const { fixture, el, notified, button, set } = setup(UserRole.STUDENT, 'student');
    const mine = backend.expectOne((r) => r.url === `${api}/search`);
    expect(mine.request.params.get('studentId')).toBe('sp-1');
    mine.flush(
      libraryPage([fakeLoan({ status: LoanStatus.BORROWED, dueAt: '2099-01-10T12:00:00Z' })]),
    );
    await fixture.whenStable();
    expect(el.textContent).toContain('Due 10 Jan 2099');
    expect(button('Issue LN-2026-0007')).toBeUndefined();

    button('Renew LN-2026-0007')!.click();
    await fixture.whenStable();
    el.querySelector('app-loan-action form')!.dispatchEvent(new Event('submit'));
    const renew = backend.expectOne(`${api}/loan-1/renew`);
    renew.flush({
      ...ok(fakeLoan({ status: LoanStatus.BORROWED, renewalCount: 1 })),
      message: 'Renewed.',
    });
    backend
      .expectOne((r) => r.url === `${api}/search`)
      .flush(libraryPage([fakeLoan({ status: LoanStatus.BORROWED })]));
    await fixture.whenStable();

    button('Return LN-2026-0007')!.click();
    await fixture.whenStable();
    set('la-notes', 'Left it at the desk');
    el.querySelector('app-loan-action form')!.dispatchEvent(new Event('submit'));
    const ret = backend.expectOne(`${api}/loan-1/return`);
    expect(ret.request.body).toEqual({ note: 'Left it at the desk' });
    ret.flush({
      ...ok(fakeLoan({ status: LoanStatus.RETURN_REQUESTED })),
      message: 'Return requested.',
    });
    backend.expectOne((r) => r.url === `${api}/search`).flush(libraryPage([]));
    await fixture.whenStable();
    expect(notified).toEqual(['Renewed.', 'Return requested.']);
  });
});
