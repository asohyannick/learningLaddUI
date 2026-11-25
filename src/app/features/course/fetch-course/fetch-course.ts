import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
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
import { EnumLabelPipe } from '../../../shared/custom-pipe/enum-label-pipe';
import { CourseResponse } from '../course.model';
import { CourseService, finalPrice } from '../course.service';

@Component({
  selector: 'app-fetch-course',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, EnumLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
  templateUrl: './fetch-course.html',
})
export class FetchCourse {
  private readonly courses = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly courseId = input.required<string>();
  readonly canWrite = input(false);
  readonly canDelete = input(false);
  readonly closed = output<void>();
  readonly edit = output<CourseResponse>();
  readonly remove = output<CourseResponse>();

  protected readonly course = signal<CourseResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private request?: Subscription;

  protected readonly downloading = signal(false);
  protected readonly downloadError = signal<string | null>(null);
  protected readonly videoFailed = signal(false);

  protected isVideo(contentType: string | null | undefined): boolean {
    return !!contentType?.startsWith('video/');
  }

  protected readonly price = computed(() => {
    const course = this.course();
    return course ? finalPrice({ price: course.price ?? 0, discount: course.discount ?? 0 }) : 0;
  });

  constructor() {
    effect(() => {
      const id = this.courseId();
      untracked(() => this.load(id));
    });
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('aside')?.focus());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected onEscape(): void {
    if (!document.querySelector('app-modal')) this.closed.emit();
  }

  load(id: string = this.courseId()): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.videoFailed.set(false);
    this.request = this.courses
      .getCourse(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (course) => {
          this.course.set(course);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.course.set(null);
          this.error.set(
            isApiErrorResponse(error) ? error.message : 'Could not load this course. Try again.',
          );
          this.loading.set(false);
        },
      });
  }

  protected download(course: CourseResponse): void {
    this.downloadError.set(null);
    this.downloading.set(true);
    this.courses
      .downloadCoursePdf(course.id, course.slug || 'course')
      .pipe(
        finalize(() => this.downloading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => this.downloadError.set('Could not download the PDF. Try again.') });
  }
}
