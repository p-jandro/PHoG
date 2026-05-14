import { useEffect, useState } from 'react';

/**
 * Tick-based countdown to a server-provided `endsAt` epoch (ms). Returns
 * milliseconds remaining (clamped to >= 0). Ticks at 250ms which is plenty
 * for second-resolution displays.
 */
export function useCountdown(endsAt: number | null | undefined) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );
  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return remainingMs;
}
