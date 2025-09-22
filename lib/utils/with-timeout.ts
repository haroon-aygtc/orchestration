// lib/utils/with-timeout.ts
export async function withTimeout<T>(fn: () => Promise<T>, ms: number, label = "timeout"): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      // if your llmService.chat supports AbortSignal, pass ctrl.signal through
      // else: just race a promise
      return await Promise.race([
        fn(),
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error(label)), ms)),
      ]) as T;
    } finally {
      clearTimeout(timer);
    }
  }
  