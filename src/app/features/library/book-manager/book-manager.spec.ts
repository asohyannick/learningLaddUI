import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../../core/enum/global-enum-configuration';
import { errorInterceptor } from '../../../core/interceptor/error.interceptor';
import { AuthService } from '../../../core/service/auth/auth.service';
import { fakeBook, fakeLoan, libraryPage } from '../../../core/testing/fake-library';
import { fakeLoginResponse, ok } from '../../../core/testing/fake-login-response';
import { BookManager } from './book-manager';

const api = `${environment.apiUrl}/library`;
const listUrl = `${api}/books?page=0&size=20`;

describe('BookManager', () => {
  let backend: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem('ll.studentProfileId.me');
    await TestBed.configureTestingModule({
      imports: [BookManager],
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

  async function render(role: UserRole) {
    TestBed.inject(AuthService).startSession(fakeLoginResponse({ id: 'me', role }));
    const fixture = TestBed.createComponent(BookManager);
    const notified: string[] = [];
    fixture.componentInstance.notify.subscribe((m) => notified.push(m));
    fixture.detectChanges();
    backend.expectOne(`${api}/books/count`).flush(ok(9));
    backend.expectOne(listUrl).flush(libraryPage([fakeBook()], 9));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    return { fixture, el, notified, button, set };
  }

  it('lists the catalog with copies and availability for librarians', async () => {
    const { el, button } = await render(UserRole.LIBRARIAN);
    expect(el.querySelector('[data-testid="book-count"]')?.textContent?.trim()).toBe('9');
    const row = el.querySelector('tbody')!.textContent!;
    expect(row).toContain('Clean Code');
    expect(row).toContain('Robert C. Martin · 2008');
    expect(row).toContain('2 of 3');
    expect(row).toContain('Available');
    expect(button('Add book')).toBeDefined();
    expect(el.querySelector('button[aria-label="Borrow Clean Code"]')).toBeNull();
  });

  it('downloads the books matching the filters as PDF, and shows why it failed', async () => {
    const { fixture, el, button } = await render(UserRole.SUPER_ADMIN);
    const available = el.querySelector<HTMLInputElement>('#books-available-only')!;
    available.click();
    fixture.detectChanges();
    backend.expectOne((r) => r.url === `${api}/books/search`).flush(libraryPage([fakeBook()]));
    await fixture.whenStable();

    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    button('Download matches (PDF)')!.click();
    const pdf = backend.expectOne((r) => r.url === `${api}/books/download`);
    expect(pdf.request.params.get('availableOnly')).toBe('true');
    expect(pdf.request.params.get('sortBy')).toBe('title');
    expect(pdf.request.params.has('page')).toBe(false);
    expect(pdf.request.params.has('size')).toBe(false);
    pdf.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="library-catalog-2026-11-25.pdf"' },
    });
    await fixture.whenStable();
    expect(save).toHaveBeenCalled();
    save.mockRestore();

    button('Download matches (PDF)')!.click();
    backend
      .expectOne((r) => r.url === `${api}/books/download`)
      .flush(
        new Blob([JSON.stringify({ status: 403, message: 'Access denied' })], {
          type: 'application/json',
        }),
        { status: 403, statusText: 'Forbidden' },
      );
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Access denied');
  });

  it('adds a book with its loan rules and cover', async () => {
    const { fixture, el, notified, button, set } = await render(UserRole.SUPER_ADMIN);
    button('Add book')!.click();
    await fixture.whenStable();
    set('bf-title', ' Refactoring ');
    set('bf-isbn', '978-0-13-468599-1x');
    el.querySelector('app-book-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Author is required.');
    expect(el.textContent).toContain('Enter a 10- or 13-digit ISBN');

    set('bf-author', 'Martin Fowler');
    set('bf-isbn', '978-0-13-468599-1');
    set('bf-totalCopies', '4');
    set('bf-dailyLateFee', '0.25');
    set('bf-currency', 'xaf');
    const cover = new File(['x'], 'c.png', { type: 'image/png' });
    const picker = el.querySelector<HTMLInputElement>('[data-testid="cover-input"]')!;
    Object.defineProperty(picker, 'files', { value: [cover] });
    picker.dispatchEvent(new Event('change'));
    el.querySelector('app-book-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const add = backend.expectOne(`${api}/books`);
    const body = add.request.body as FormData;
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      borrowable: true,
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780134685991',
      totalCopies: 4,
      dailyLateFee: 0.25,
      currency: 'XAF',
    });
    expect(body.get('coverImage')).toBe(cover);
    add.flush(ok(fakeBook({ id: 'book-2', title: 'Refactoring' })));
    backend.expectOne(listUrl).flush(libraryPage([fakeBook()], 10));
    backend.expectOne(`${api}/books/count`).flush(ok(10));
    await fixture.whenStable();
    expect(notified).toEqual(['“Refactoring” was added to the catalog.']);
  });

  it('edits only what changed and can withdraw a book', async () => {
    const { fixture, el, notified, set } = await render(UserRole.LIBRARIAN);
    el.querySelector<HTMLButtonElement>('button[aria-label="Edit Clean Code"]')!.click();
    fixture.detectChanges();
    backend.expectOne(`${api}/books/book-1`).flush(ok(fakeBook()));
    await fixture.whenStable();
    set('bf-shelfLocation', '');
    set('bf-totalCopies', '5');
    el.querySelector<HTMLInputElement>('#bf-active')!.click();
    el.querySelector('app-book-form form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    const update = backend.expectOne(`${api}/books/book-1`);
    expect(update.request.method).toBe('PATCH');
    const data = (update.request.body as FormData).get('data') as Blob;
    expect(JSON.parse(await data.text())).toEqual({
      active: false,
      shelfLocation: '',
      totalCopies: 5,
    });
    update.flush(ok(fakeBook({ active: false })));
    backend.expectOne(listUrl).flush(libraryPage([fakeBook()], 9));
    backend.expectOne(`${api}/books/count`).flush(ok(9));
    await fixture.whenStable();
    expect(notified).toEqual(['Changes to “Clean Code” were saved.']);
  });

  it('lets students borrow, and remembers their student profile ID', async () => {
    const { fixture, el, notified, button } = await render(UserRole.STUDENT);
    expect(button('Add book')).toBeUndefined();
    expect(button('Download catalog (PDF)')).toBeUndefined();
    expect(el.querySelector('button[aria-label="Edit Clean Code"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('button[aria-label="Borrow Clean Code"]')!.click();
    await fixture.whenStable();
    const notes = el.querySelector<HTMLTextAreaElement>('#borrow-notes')!;
    notes.value = 'Collect on Friday';
    notes.dispatchEvent(new Event('input'));
    button('Reserve a copy')!.click();

    const borrow = backend.expectOne(`${api}/loans`);
    expect(borrow.request.body).toEqual({ bookId: 'book-1', notes: 'Collect on Friday' });
    expect(borrow.request.headers.get('Idempotency-Key')?.length).toBeGreaterThanOrEqual(8);
    borrow.flush(
      { ...ok(fakeLoan()), message: '"Clean Code" reserved (LN-2026-0007).' },
      { status: 201, statusText: 'Created' },
    );
    backend.expectOne(listUrl).flush(libraryPage([fakeBook({ availableCopies: 1 })], 9));
    backend.expectOne(`${api}/books/count`).flush(ok(9));
    await fixture.whenStable();
    expect(notified).toEqual(['"Clean Code" reserved (LN-2026-0007).']);
    expect(localStorage.getItem('ll.studentProfileId.me')).toBe('sp-1');
  });
});
