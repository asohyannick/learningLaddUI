import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeBook, fakeLoan, libraryPage } from '../../../core/testing/fake-library';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { LibrarianDashboard } from './librarian-dashboard';

const api = `${environment.apiUrl}/library`;

describe('LibrarianDashboard', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibrarianDashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).startSession(
      fakeLoginResponse({ id: 'lib', role: UserRole.LIBRARIAN }),
    );
  });

  afterEach(() => {
    backend.verify();
    TestBed.inject(AuthService).endSession();
  });

  it('opens on the catalog with staff tools', async () => {
    const fixture = TestBed.createComponent(LibrarianDashboard);
    fixture.detectChanges();
    backend.expectOne(`${api}/books/count`).flush(ok(1));
    backend.expectOne(`${api}/books?page=0&size=20`).flush(libraryPage([fakeBook()]));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Library catalog');
    expect(el.textContent).toContain('Add book');
    expect(el.textContent).toContain('Clean Code');
  });

  it('shows every loan in the Loans section', async () => {
    const fixture = TestBed.createComponent(LibrarianDashboard);
    fixture.componentRef.setInput('section', 'loans');
    fixture.detectChanges();
    backend.expectOne(`${api}/loans/count`).flush(ok(2));
    backend.expectOne(`${api}/loans?page=0&size=20`).flush(libraryPage([fakeLoan()]));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Borrowed books');
    expect(el.querySelector('[data-testid="loan-count"]')?.textContent?.trim()).toBe('2');
  });
});
