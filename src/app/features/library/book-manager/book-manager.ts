import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LIBRARY_MANAGER_ROLES, UserRole } from '../../../core/enum/global-enum-configuration';
import { AuthService } from '../../../core/service/auth/auth.service';
import { BookForm, BookSaved } from '../book-form/book-form';
import { BorrowBook } from '../borrow-book/borrow-book';
import { DeleteBook } from '../delete-book/delete-book';
import { FetchAllBooks } from '../fetch-all-books/fetch-all-books';
import { FetchBook } from '../fetch-book/fetch-book';
import { LibraryBookResponseDto, LibraryLoanResponseDto } from '../library.model';
import { StudentIdentityStore } from '../student-identity.store';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; book: { id: string; title: string } }
  | { kind: 'borrow'; book: LibraryBookResponseDto };

@Component({
  selector: 'app-book-manager',
  imports: [BookForm, BorrowBook, DeleteBook, FetchAllBooks, FetchBook],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-fetch-all-books
      [canManage]="canManage()"
      [canBorrow]="canBorrow()"
      (add)="dialog.set({ kind: 'create' })"
      (view)="selectedId.set($event.id)"
      (edit)="dialog.set({ kind: 'edit', id: $event.id })"
      (remove)="askDelete($event)"
      (borrow)="dialog.set({ kind: 'borrow', book: $event })"
    />

    @if (selectedId(); as id) {
      <app-fetch-book
        [bookId]="id"
        [canManage]="canManage()"
        [canBorrow]="canBorrow()"
        (closed)="selectedId.set(null)"
        (edit)="dialog.set({ kind: 'edit', id: $event.id })"
        (remove)="askDelete($event)"
        (borrow)="dialog.set({ kind: 'borrow', book: $event })"
      />
    }

    @if (dialog(); as d) {
      @switch (d.kind) {
        @case ('create') {
          <app-book-form (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
        }
        @case ('edit') {
          <app-book-form [bookId]="d.id" (done)="onSaved($event)" (cancelled)="dialog.set(null)" />
        }
        @case ('delete') {
          <app-delete-book
            [book]="d.book"
            (done)="onDeleted(d.book.id, $event)"
            (cancelled)="dialog.set(null)"
          />
        }
        @case ('borrow') {
          <app-borrow-book
            [book]="d.book"
            (done)="onBorrowed($event)"
            (cancelled)="dialog.set(null)"
          />
        }
      }
    }
  `,
})
export class BookManager {
  private readonly auth = inject(AuthService);
  private readonly identity = inject(StudentIdentityStore);

  readonly notify = output<string>();
  readonly borrowed = output<LibraryLoanResponseDto>();

  protected readonly canManage = computed(() => {
    this.auth.role();
    return this.auth.hasAnyRole(LIBRARY_MANAGER_ROLES);
  });
  protected readonly canBorrow = computed(() => this.auth.role() === UserRole.STUDENT);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly dialog = signal<Dialog | null>(null);

  private readonly list = viewChild.required(FetchAllBooks);
  private readonly panel = viewChild(FetchBook);

  protected askDelete(book: { id: string; title: string }): void {
    this.dialog.set({ kind: 'delete', book: { id: book.id, title: book.title } });
  }

  protected onSaved(saved: BookSaved): void {
    this.dialog.set(null);
    this.list().reload();
    this.panel()?.load();
    this.notify.emit(saved.message);
  }

  protected onDeleted(id: string, message: string): void {
    this.dialog.set(null);
    if (this.selectedId() === id) this.selectedId.set(null);
    this.list().reload();
    this.notify.emit(message);
  }

  protected onBorrowed(result: { loan: LibraryLoanResponseDto; message: string }): void {
    this.dialog.set(null);
    this.identity.remember(result.loan.studentId);
    this.list().reload();
    this.panel()?.load();
    this.borrowed.emit(result.loan);
    this.notify.emit(result.message);
  }
}
