import { useEffect } from 'react';

/**
 * Hold a screen wake lock while `active` is true.
 *
 * The Wake Lock API is only available on HTTPS / localhost and only on browsers
 * that support it (most current iOS Safari, Android Chrome). When unavailable
 * we silently no-op — phones will lock as they normally would.
 *
 * Locks are auto-released by the browser when the document loses visibility, so
 * we also re-acquire on `visibilitychange` while still `active`.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
      }).wakeLock;
      if (!wakeLock) return;
      try {
        const lock = await wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        sentinel.addEventListener('release', () => {
          sentinel = null;
        });
      } catch (err) {
        // Common reasons: page hidden, low battery mode, iOS Private mode.
        // Not worth surfacing to the user — wake-keep is a "nice to have".
        console.warn('[wakeLock] request failed:', err);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) {
        acquire();
      }
    };

    acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [active]);
}

// Minimal WakeLockSentinel typing — Vite's lib.dom may or may not include it
// depending on TS version, so we declare a slim local copy.
interface WakeLockSentinel extends EventTarget {
  release(): Promise<void>;
}
