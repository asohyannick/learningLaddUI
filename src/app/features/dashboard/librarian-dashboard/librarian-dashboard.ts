import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  DashboardSection,
  DashboardShell,
} from '../../../shared/reusable-components/dashboard-shell/dashboard-shell';
import { BookManager } from '../../library/book-manager/book-manager';
import { LoanManager } from '../../library/loan-manager/loan-manager';

type Section = 'library' | 'loans';

const SECTIONS: readonly DashboardSection[] = [
  { id: 'library', label: 'Catalog', icon: 'library' },
  { id: 'loans', label: 'Loans', icon: 'loans' },
];

const HEADINGS: Record<Section, string> = {
  library: 'Library catalog',
  loans: 'Borrowed books',
};

const DESCRIPTIONS: Record<Section, string> = {
  library: 'Add, edit and remove books, manage copies and loan rules, and search the catalog.',
  loans:
    'Issue reservations, update loans, confirm returns, handle late fees and lost books, and export loans as PDF.',
};

/**
 * Librarian console. Catalog: add, search, view, edit and delete books.
 * Loans: issue, update, confirm returns, cancel, report lost, delete, search, count and PDF.
 */
@Component({
  selector: 'app-librarian-dashboard',
  imports: [BookManager, DashboardShell, LoanManager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dashboard-shell
      consoleLabel="Library desk"
      [sections]="sections"
      [active]="active()"
      [heading]="heading()"
      [description]="description()"
      [(toast)]="toast"
    >
      @if (active() === 'loans') {
        <app-loan-manager mode="staff" (notify)="toast.set($event)" />
      } @else {
        <app-book-manager (notify)="toast.set($event)" />
      }
    </app-dashboard-shell>
  `,
})
export class LibrarianDashboard {
  /** `?section=` from the URL (bound by the router). */
  readonly section = input<string>();

  protected readonly sections = SECTIONS;
  protected readonly active = computed<Section>(() =>
    this.section() === 'loans' ? 'loans' : 'library',
  );
  protected readonly heading = computed(() => HEADINGS[this.active()]);
  protected readonly description = computed(() => DESCRIPTIONS[this.active()]);
  protected readonly toast = signal<string | null>(null);
}
