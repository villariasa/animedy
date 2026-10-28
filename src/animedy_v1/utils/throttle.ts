// Simple per-source request throttle: serializes calls with a minimum
// spacing between dispatch times, without blocking on task completion time.

export type ThrottledFn = <T>(task: () => Promise<T>) => Promise<T>;

export function createThrottle(minIntervalMs: number): ThrottledFn {
  let lastDispatch = 0;
  let queueTail: Promise<void> = Promise.resolve();

  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    const gate = queueTail.then(async () => {
      const now = Date.now();
      const wait = lastDispatch + minIntervalMs - now;
      if (wait > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, wait);
        });
      }
      lastDispatch = Date.now();
    });
    queueTail = gate;
    return gate.then(task);
  };
}
