import { useGameStore } from '../stores/gameStore';

/**
 * A slim status banner pinned to the top of the screen that surfaces
 * connection state during gameplay. Hidden when connected and clean;
 * appears yellow while reconnecting, red on a hard error. Reads `connected`
 * and `connectionError` from the game store with selector subscriptions so
 * it doesn't cause the rest of the app to re-render when status flips.
 */
export const ConnectionBanner = () => {
  const connected = useGameStore((s) => s.connected);
  const connectionError = useGameStore((s) => s.connectionError);

  // While everything is fine, render nothing.
  if (connected && !connectionError) {
    return null;
  }

  const isError = Boolean(connectionError);
  const message = isError ? connectionError : 'Reconnecting…';
  const colourClasses = isError
    ? 'bg-game-incorrect/90 text-white'
    : 'bg-game-warning/90 text-black';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-0 right-0 top-0 z-50 px-3 py-2 text-center text-sm font-semibold shadow-[0_8px_16px_rgba(0,0,0,0.2)] ${colourClasses}`}
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
    >
      {message}
    </div>
  );
};
