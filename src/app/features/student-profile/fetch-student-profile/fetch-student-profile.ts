import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, finalize } from 'rxjs';
import { isApiErrorResponse } from '../../../core/interface';
import { StudentProfileDetails } from '../student-profile-details/student-profile-details';
import { StudentProfileResponse } from '../student-profile.model';
import { StudentProfileService } from '../student-profile.service';

@Component({
  selector: 'app-fetch-student-profile',
  imports: [StudentProfileDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="fixed inset-0 z-40">
      <div
        class="absolute inset-0 bg-navy-950/60 backdrop-blur-[2px]"
        (click)="closed.emit()"
      ></div>
      <aside
        class="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-white/10 bg-navy-900 text-slate-200 shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-panel-title"
        tabindex="-1"
      >
        <header class="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="student-panel-title" class="text-base font-semibold text-white">
            Student profile
          </h2>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close student profile"
            (click)="closed.emit()"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
              />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-6 py-6">
          @if (loading() && !profile()) {
            <div class="animate-pulse space-y-4" role="status" aria-label="Loading profile">
              <div class="flex items-center gap-4">
                <div class="h-20 w-20 rounded-full bg-white/10"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-5 w-2/3 rounded bg-white/10"></div>
                  <div class="h-3 w-1/2 rounded bg-white/10"></div>
                </div>
              </div>
              @for (row of [1, 2, 3, 4, 5]; track row) {
                <div class="h-10 rounded-lg bg-white/5"></div>
              }
            </div>
          } @else if (error(); as message) {
            <div
              class="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200"
              role="alert"
            >
              <p>{{ message }}</p>
              <button type="button" class="mt-2 font-semibold underline" (click)="load()">
                Try again
              </button>
            </div>
          } @else if (profile(); as p) {
            <app-student-profile-details [profile]="p" />
            @if (downloadError(); as message) {
              <p class="mt-6 text-sm text-rose-300" role="alert">{{ message }}</p>
            }
          }
        </div>

        @if (profile(); as p) {
          <footer class="flex flex-wrap gap-2 border-t border-white/10 px-6 py-4">
            <button
              type="button"
              class="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"
              [disabled]="downloading()"
              (click)="download(p)"
            >
              {{ downloading() ? 'Preparing PDF…' : 'Download PDF' }}
            </button>
            @if (canManage()) {
              <button
                type="button"
                class="flex-1 rounded-lg bg-royal px-4 py-2.5 text-sm font-semibold text-white hover:bg-royal-dark"
                (click)="edit.emit(p)"
              >
                Edit profile
              </button>
              <button
                type="button"
                class="rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
                (click)="remove.emit(p)"
              >
                Delete
              </button>
            }
          </footer>
        }
      </aside>
    </div>
  `,
})
export class FetchStudentProfile {
  private readonly profiles = inject(StudentProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly profileId = input.required<string>();
  readonly canManage = input(false);
  readonly closed = output<void>();
  readonly edit = output<StudentProfileResponse>();
  readonly remove = output<StudentProfileResponse>();

  protected readonly profile = signal<StudentProfileResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  private request?: Subscription;

  constructor() {
    effect(() => {
      const id = this.profileId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.profileId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.profiles
      .getProfile(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.profile.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this profile. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected download(profile: StudentProfileResponse): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.profiles
      .downloadProfilePdf(profile)
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) =>
          this.downloadError.set(
            isApiErrorResponse(error) ? error.message : 'Could not download the PDF. Try again.',
          ),
      });
  }
}
