import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { fakeBook, fakeLoan, libraryPage } from '../../core/testing/fake-library';
import { ok } from '../../core/testing/fake-login-response';
import { LoanStatus } from './library.model';
import { LibraryService, loanActions, loanWhen, money } from './library.service';

const api = `${environment.apiUrl}/library`;

describe('LibraryService', () => {
  let service: LibraryService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LibraryService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('reads books: list, search, count and one', () => {
    let titles = 0;
    service.listBooks(1, 50).subscribe((p) => (titles = p.totalElements));
    service
      .searchBooks({
        keyword: ' clean ',
        availableOnly: true,
        active: false,
        publicationYearFrom: 2000,
        category: '',
      })
      .subscribe();
    let count = 0;
    service.countBooks().subscribe((n) => (count = n));
    service.getBook('book-1').subscribe();
    backend.expectOne(`${api}/books?page=1&size=50`).flush(libraryPage([fakeBook()], 4));
    const search = backend.expectOne((r) => r.url === `${api}/books/search`);
    expect(search.request.params.get('keyword')).toBe('clean');
    expect(search.request.params.get('availableOnly')).toBe('true');
    expect(search.request.params.get('active')).toBe('false');
    expect(search.request.params.has('category')).toBe(false);
    search.flush(libraryPage([]));
    backend.expectOne(`${api}/books/count`).flush(ok(12));
    backend.expectOne(`${api}/books/book-1`).flush(ok(fakeBook()));
    expect(titles).toBe(4);
    expect(count).toBe(12);
  });

  it('adds and updates books as multipart, and deletes', async () => {
    const cover = new File(['x'], 'c.png', { type: 'image/png' });
    service.addBook({ title: 'Refactoring', author: 'Martin Fowler' }, cover).subscribe();
    const add = backend.expectOne(`${api}/books`);
    expect(add.request.method).toBe('POST');
    const body = add.request.body as FormData;
    expect(JSON.parse(await (body.get('data') as Blob).text())).toEqual({
      title: 'Refactoring',
      author: 'Martin Fowler',
    });
    expect(body.get('coverImage')).toBe(cover);
    add.flush(ok(fakeBook()));

    service.updateBook('book-1', { totalCopies: 0 }).subscribe();
    const update = backend.expectOne(`${api}/books/book-1`);
    expect(update.request.method).toBe('PATCH');
    expect((update.request.body as FormData).has('coverImage')).toBe(false);
    update.flush(ok(fakeBook()));

    service.deleteBook('book-1').subscribe();
    expect(backend.expectOne(`${api}/books/book-1`).request.method).toBe('DELETE');
  });

  it('borrows with an Idempotency-Key and calls each loan action on its own path', () => {
    service.borrowBook({ bookId: 'book-1' }, 'key-12345678').subscribe();
    const borrow = backend.expectOne(`${api}/loans`);
    expect(borrow.request.method).toBe('POST');
    expect(borrow.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    expect(borrow.request.body).toEqual({ bookId: 'book-1' });
    borrow.flush(ok(fakeLoan()));

    service.issueBook('loan-1', { conditionOnBorrow: 'Good' }).subscribe();
    service.updateLoan('loan-1', { notes: 'Late pickup' }).subscribe();
    service.renewLoan('loan-1').subscribe();
    service.returnLoan('loan-1', { note: 'Desk' }).subscribe();
    service.confirmReturn('loan-1', { conditionOnReturn: 'Fine', waiveLateFee: true }).subscribe();
    service.cancelReservation('loan-1').subscribe();
    service.reportLost('loan-1', { description: 'Left on a bus' }).subscribe();
    for (const path of [
      'loan-1/issue',
      'loan-1',
      'loan-1/renew',
      'loan-1/return',
      'loan-1/confirm-return',
      'loan-1/cancel',
      'loan-1/report-lost',
    ]) {
      const req = backend.expectOne(`${api}/loans/${path}`);
      expect(req.request.method).toBe('PATCH');
      req.flush(ok(fakeLoan()));
    }
    service.deleteLoan('loan-1').subscribe();
    expect(backend.expectOne(`${api}/loans/loan-1`).request.method).toBe('DELETE');
  });

  it('lists, searches, counts and exports loans', () => {
    service.listLoans().subscribe();
    service
      .searchLoans({ studentId: 'sp-1', status: LoanStatus.OVERDUE, overdueOnly: true })
      .subscribe();
    service.countBorrowedBooks().subscribe();
    backend.expectOne(`${api}/loans?page=0&size=20`).flush(libraryPage([]));
    const search = backend.expectOne((r) => r.url === `${api}/loans/search`);
    expect(search.request.params.get('studentId')).toBe('sp-1');
    expect(search.request.params.get('status')).toBe('OVERDUE');
    search.flush(libraryPage([]));
    backend.expectOne(`${api}/loans/count`).flush(ok(3));

    const save = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    let name = '';
    service.downloadLoanPdf(fakeLoan()).subscribe((n) => (name = n));
    const pdf = backend.expectOne((r) => r.url === `${api}/loans/download`);
    expect(pdf.request.params.get('keyword')).toBe('LN-2026-0007');
    pdf.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': 'attachment; filename="borrowed-books.pdf"' },
    });
    expect(name).toBe('borrowed-books.pdf');
    save.mockRestore();
  });

  it('offers the actions each status allows', () => {
    const at = (status: LoanStatus) => fakeLoan({ status });
    expect(loanActions(at(LoanStatus.RESERVED), 'staff')).toEqual(['issue', 'cancel']);
    expect(loanActions(at(LoanStatus.OVERDUE), 'staff')).toEqual(['confirm', 'update', 'lost']);
    expect(loanActions(at(LoanStatus.RETURNED), 'staff')).toEqual(['delete']);
    expect(loanActions(at(LoanStatus.BORROWED), 'student')).toEqual(['renew', 'return', 'lost']);
    expect(loanActions(at(LoanStatus.OVERDUE), 'student')).toEqual(['return', 'lost']);
    expect(loanActions(at(LoanStatus.RETURNED), 'student')).toEqual([]);
    expect(loanWhen(fakeLoan())).toBe('Pick up by 26 Nov 2026');
    expect(money(1.5, 'USD')).toBe('USD 1.50');
  });
});
