import { DestroyRef, Signal, signal } from '@angular/core';

export interface Countdown {
  readonly remaining: Signal<number>;
  start(seconds: number): void;
}

export function createCountdown(destroyRef: DestroyRef): Countdown {
  const remaining = signal(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  destroyRef.onDestroy(stop);
  return {
    remaining: remaining.asReadonly(),
    start(seconds: number) {
      stop();
      remaining.set(seconds);
      timer = setInterval(() => {
        remaining.update((s) => s - 1);
        if (remaining() <= 0) {
          stop();
        }
      }, 1000);
    },
  };
}
