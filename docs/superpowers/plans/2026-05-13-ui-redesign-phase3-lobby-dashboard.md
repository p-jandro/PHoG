# Phase 3 — Lobby + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the **player Lobby** (`packages/client/src/screens/Lobby.tsx`) and the **host Dashboard** (`packages/host/src/screens/Dashboard.tsx`) to consume the new design-system primitives shipped in the Phase 2 foundation plan. After this plan ships, both screens look and feel like the new design language: chunky 2px-ink-bordered cards, hard offset shadows, semantic colors (`action`/`info`/`now`/`streak`/`premium`), Inter / Inter Tight typography, status pill with live dot, deterministic-color player avatars, and the host-screen skeleton (location top-left, dimmed time-left top-right, content centre, player tracker bottom) introduced as a reusable `HostScreenShell` wrapper.

**Architecture:** The Lobby is small (118 lines, two render branches) — it gets a flat in-place migration plus a `ThemeToggle` in the top-right of the page wrapper. The Dashboard is large (867 lines) and tangles four sub-screens (login, control panel, championship table, quick guide) plus a live-game banner that is **already obsolete** for the redesign (Phase 4 introduces the proper Countdown/Live primitives; the live-game banner in the Dashboard duplicates what the Display screen already shows and the spec §7.3 explicitly assigns "active game shell" to Display, not Dashboard). To keep this PR scoped and reviewable, the Dashboard migration:

1. Removes the Live Game panel (lines 493–551 of current Dashboard) — it was duplicating Display and isn't in the spec's Dashboard layout
2. Removes the Quick Guide panel (lines 840–862) — three placeholder marketing tiles, not in the spec
3. Removes the Championship Table panel (lines 781–837) — championship standings live on Display/FinalLeaderboard, not on Dashboard per spec §7.3
4. Replaces the remaining layout with the spec's three-column layout: **QR card left · launcher grid + secondary row middle · scrollable player tracker right** inside a new `HostScreenShell` that owns the dimmed time-left slot top-right

The `HostScreenShell` is introduced here because every host screen in Phases 4–10 needs the same skeleton; building it now means later phases just consume it. It lives in `packages/host/src/ui/HostScreenShell.tsx` alongside the other primitives.

A reusable `PlayerTracker` is also introduced here (the right-column scrollable list of connected players with live scores) — it will be re-used by every other host screen in Phases 4–10 per spec §7.3 ("the player tracker bottom — and nothing competes with it above"). It lives at `packages/host/src/ui/PlayerTracker.tsx`.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 (rewritten in foundation) · framer-motion 10 (existing) · `qrcode.react@4.2.0` (already in `packages/host/package.json`). No new dependencies.

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md) — §1 (manifesto), §2 (tokens), §3 (primitives), §4.2 + §4.3 (motion), §5 (theme), §7.1 (Lobby), §7.3 (Dashboard).

**Foundation reference:** [docs/superpowers/plans/2026-05-13-ui-redesign-foundation.md](./2026-05-13-ui-redesign-foundation.md) — the 11 primitives + theme provider + motion utilities this plan consumes.

**Out of scope:**
- Migrating any other player screen (Countdown, Quiz, Wordle, etc.) — those are Phases 4–10
- Migrating the host `Display` screen or any per-game host display — those are Phases 4–10
- Removing legacy `index.css` rules (`.card`, `.btn-primary`, `.input-field`, `.eyebrow`, `.section-label`, `.status-pill`, `.screen-shell`, `.screen-frame`) — kept alive so the rest of the app keeps rendering until Phase 11
- Removing deprecated Tailwind tokens (`primary.*`, `game.*`, `ui.*`, `answer.A-D`, `medal.*`, `difficulty.*`) — also kept until Phase 11
- Server-side / data-layer changes
- The dev password authentication flow itself — only the visual chrome around the password input changes
- Audio
- The host App.tsx top-bar Dashboard/Display toggle (kept verbatim — it's a navigation primitive, not a screen)

---

## File map

**Client (`packages/client/`):**
- *Modify:* `src/screens/Lobby.tsx` — replace classes with new primitives, both render branches

**Host (`packages/host/`):**
- *Create:* `src/ui/HostScreenShell.tsx` — reusable host-screen skeleton (location top-left · time-left top-right · content centre · player tracker bottom)
- *Create:* `src/ui/PlayerTracker.tsx` — connected-players scrollable list with live scores (re-used by every host screen in Phases 4–10)
- *Modify:* `src/ui/index.ts` — export `HostScreenShell` and `PlayerTracker`
- *Modify:* `src/screens/Dashboard.tsx` — replace login screen + control panel with new primitives; remove deprecated Live Game, Championship Table, Quick Guide panels; consume `HostScreenShell` and `PlayerTracker`

**No file is created outside `packages/client/src/screens/`, `packages/host/src/screens/`, or `packages/host/src/ui/`.** Nothing is removed from `index.css` or `tailwind.config.js`.

---

## Tasks

### Task 1: Migrate the Lobby pre-join (join form) branch

**Files:**
- Modify: `packages/client/src/screens/Lobby.tsx`

Goal of this task: replace the **pre-join** branch (the `return (...)` block at the end of the file, lines 59–117) with the new primitives. Leave the post-join branch alone in this task — it's migrated in Task 2 so the diff stays reviewable.

- [ ] **Step 1: Replace the entire file with the version below**

The new file:
- imports `Button`, `Input`, `Card`, `Pill` from `../ui`
- imports `ThemeToggle` (mounted top-right of the page so the player can flip theme even before joining)
- keeps the existing `motion.div` entry animation but uses the `screenEnter` variant from `motion.ts`
- post-join branch is **unchanged** (still using legacy classes) — Task 2 migrates it

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { joinGame } from '../hooks/useSocket';
import { Button, Input, Card, Pill, ThemeToggle } from '../ui';
import { screenEnter } from '../lib/motion';

interface LobbyProps {
  socket: Socket | null;
}

export const Lobby = ({ socket }: LobbyProps) => {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { connected, connectionError, playerId, playerName } = useGameStore();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && socket && connected) {
      setIsJoining(true);
      joinGame(socket, name.trim());
      setTimeout(() => setIsJoining(false), 2000);
    }
  };

  // Post-join branch — still uses legacy classes; migrated in Task 2.
  if (playerId && playerName) {
    return (
      <div className="screen-shell flex items-center">
        <div className="screen-frame max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col justify-between gap-8 p-8 text-center sm:p-10"
          >
            <div className="space-y-5">
              <span className="eyebrow">Checked In</span>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold sm:text-5xl">
                  You are in, {playerName}.
                </h1>
                <p className="mx-auto max-w-xl text-lg leading-relaxed text-ui-textMuted">
                  Keep this screen open. The host will move everyone from the lounge into each round automatically.
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ui-border/80 bg-black/20 p-5">
              <p className="text-lg font-semibold text-game-correct">Ready</p>
              <p className="mt-2 text-sm text-ui-textMuted">Waiting for the host.</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Pre-join branch — new design.
  const status: 'connected' | 'connecting' | 'offline' = connected
    ? 'connected'
    : connectionError
      ? 'offline'
      : 'connecting';
  const statusLabel = connected
    ? 'Connected to game server'
    : connectionError
      ? 'Offline'
      : 'Connecting to game server';

  return (
    <div className="min-h-screen bg-bg-base text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
        <header className="flex items-center justify-end">
          <ThemeToggle />
        </header>

        <motion.div
          variants={screenEnter}
          initial="hidden"
          animate="visible"
        >
          <Card eyebrow="Player Entry" title="Join the Room">
            <div className="mt-2 mb-5 flex flex-wrap items-center gap-2">
              <Pill status={status}>{statusLabel}</Pill>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-5">
              <Input
                label="Display Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                required
                disabled={!connected || isJoining}
                error={connectionError ?? undefined}
              />
              <Button
                type="submit"
                variant="action"
                size="lg"
                disabled={!connected || !name.trim() || isJoining}
                loading={isJoining}
                className="w-full"
              >
                {isJoining ? 'Joining Room' : 'Join Game'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify the build**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Visually verify the pre-join screen in both themes**

```bash
cd packages/client
npm run dev
```
Open http://localhost:5173 (you may need the server running too, but the lobby will render even if the server is down — the `Pill` will show "Connecting..." or "Offline").

Verify:
1. The page background is cream in light mode, near-black in dark mode.
2. The Card has a 2px ink border, hard offset shadow, and "Player Entry" eyebrow in terracotta.
3. The connection pill shows the live dot (green when connected, yellow when connecting, red when offline).
4. The `Join Game` button is grass green with white text, has a hard offset shadow, and lifts on hover.
5. Toggle theme via the top-right ThemeToggle — every color flips smoothly.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/screens/Lobby.tsx
git commit -m "feat(client): redesign Lobby pre-join (join form) with new primitives"
```

---

### Task 2: Migrate the Lobby post-join (waiting card) branch + add avatar wall

**Files:**
- Modify: `packages/client/src/screens/Lobby.tsx`

Goal: replace the post-join branch with the new primitives. Add a **player avatar wall** (an inline composition of `Avatar` for each connected player, animated with framer-motion stagger as joiners arrive) — this is the visual hook the spec calls out: "avatar wall pops in as players join".

The Lobby store exposes only `playerId` and `playerName` for the current player — we don't have the full roster on the player client today. We **do** have a `players:update` socket event that broadcasts every connected player. To wire the avatar wall without expanding scope, add a tiny `lobbyPlayers` slice to `useGameStore` only if it doesn't already exist. (Most likely it doesn't.)

- [ ] **Step 1: Check if the gameStore already tracks the lobby roster**

```bash
grep -n "lobbyPlayers\|players:" packages/client/src/stores/gameStore.ts | head -30
grep -n "players:update" packages/client/src/hooks/useSocket.ts | head -10
```

- If `lobbyPlayers` is already in the store and `players:update` is already wired, skip to Step 3.
- Otherwise, perform Step 2.

- [ ] **Step 2: Add the `lobbyPlayers` slice to `useGameStore`**

Open `packages/client/src/stores/gameStore.ts`. Find the `GameState` interface (around line 55). Add to the interface:

```ts
  // Lobby roster (connected players in the room, for the avatar wall)
  lobbyPlayers: Array<{ id: string; name: string; connected: boolean }>;
  setLobbyPlayers: (players: Array<{ id: string; name: string; connected: boolean }>) => void;
```

In the `create(...)` factory, find where other state slices initialize. Add:

```ts
  lobbyPlayers: [],
  setLobbyPlayers: (lobbyPlayers) => set({ lobbyPlayers }),
```

Then wire the socket listener. Open `packages/client/src/hooks/useSocket.ts` (or wherever the socket event listeners are registered — search for an existing `'players:update'` listener; if none, add one). Add inside the `socket.on('connect', ...)` block (or alongside the other listeners):

```ts
socket.on('players:update', (players: Array<{ id: string; name: string; connected: boolean }>) => {
  useGameStore.getState().setLobbyPlayers(players ?? []);
});
```

If a `players:update` listener already exists for some other purpose, **add to it** rather than duplicating — call both pieces of logic.

- [ ] **Step 3: Replace the file with the version below**

This replaces the post-join branch with the new design, leaves the (already-migrated) pre-join branch intact, and adds the avatar wall.

```tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import { joinGame } from '../hooks/useSocket';
import { Avatar, Button, Card, Chip, Input, Pill, ThemeToggle } from '../ui';
import { screenEnter, popIn, stagger } from '../lib/motion';

interface LobbyProps {
  socket: Socket | null;
}

export const Lobby = ({ socket }: LobbyProps) => {
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { connected, connectionError, playerId, playerName, lobbyPlayers } = useGameStore();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && socket && connected) {
      setIsJoining(true);
      joinGame(socket, name.trim());
      setTimeout(() => setIsJoining(false), 2000);
    }
  };

  const status: 'connected' | 'connecting' | 'offline' = connected
    ? 'connected'
    : connectionError
      ? 'offline'
      : 'connecting';
  const statusLabel = connected
    ? 'Connected to game server'
    : connectionError
      ? 'Offline'
      : 'Connecting to game server';

  const connectedPlayers = (lobbyPlayers ?? []).filter((p) => p.connected);

  // ---------- Post-join (waiting room) ----------
  if (playerId && playerName) {
    return (
      <div className="min-h-screen bg-bg-base text-ink">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
          <header className="flex items-center justify-between">
            <Pill status={status}>{statusLabel}</Pill>
            <ThemeToggle />
          </header>

          <motion.div variants={screenEnter} initial="hidden" animate="visible">
            <Card eyebrow="Checked In">
              <div className="flex flex-col items-center gap-4 text-center">
                <Avatar name={playerName} size="lg" />
                <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                  You are in, {playerName}.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-ink-muted">
                  Keep this screen open. The host will move everyone from the lounge into each round automatically.
                </p>
                <div className="mt-2">
                  <Chip variant="now">Ready · waiting for the host</Chip>
                </div>
              </div>
            </Card>
          </motion.div>

          {connectedPlayers.length > 0 && (
            <Card
              eyebrow={`In the room · ${connectedPlayers.length} ${connectedPlayers.length === 1 ? 'player' : 'players'}`}
            >
              <motion.div
                className="flex flex-wrap gap-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: stagger.short } },
                }}
              >
                {connectedPlayers.map((p) => (
                  <motion.div
                    key={p.id}
                    variants={popIn}
                    className="flex flex-col items-center gap-1"
                  >
                    <Avatar name={p.name} size="md" />
                    <span className="max-w-[5rem] truncate text-xs font-bold text-ink-muted">
                      {p.id === playerId ? 'You' : p.name}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ---------- Pre-join (join form) — already migrated in Task 1 ----------
  return (
    <div className="min-h-screen bg-bg-base text-ink">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 sm:px-6">
        <header className="flex items-center justify-end">
          <ThemeToggle />
        </header>

        <motion.div variants={screenEnter} initial="hidden" animate="visible">
          <Card eyebrow="Player Entry" title="Join the Room">
            <div className="mt-2 mb-5 flex flex-wrap items-center gap-2">
              <Pill status={status}>{statusLabel}</Pill>
            </div>

            <form onSubmit={handleJoin} className="flex flex-col gap-5">
              <Input
                label="Display Name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                required
                disabled={!connected || isJoining}
                error={connectionError ?? undefined}
              />
              <Button
                type="submit"
                variant="action"
                size="lg"
                disabled={!connected || !name.trim() || isJoining}
                loading={isJoining}
                className="w-full"
              >
                {isJoining ? 'Joining Room' : 'Join Game'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Verify the build**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 5: End-to-end smoke test**

In three terminals (per QUICKSTART):
```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/client && npm run dev
# Terminal 3 (open a second player tab)
# just open http://localhost:5173 in two separate browsers / private windows
```

Verify:
1. Open Player A (tab 1) — pre-join Card shows; Pill shows "Connected to game server".
2. Type a name, click Join Game — waiting card appears with a large Avatar, "You are in, …", `Ready · waiting for the host` chip.
3. Below the waiting card, a "In the room · 1 player" Card shows the player's avatar.
4. Open Player B (tab 2), join — both tabs show **two** avatars in the in-the-room card; the new avatar pops in with a scale/opacity animation.
5. Toggle theme on each tab — colors flip; avatars keep their assigned colors.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/screens/Lobby.tsx packages/client/src/stores/gameStore.ts packages/client/src/hooks/useSocket.ts
git commit -m "feat(client): redesign Lobby waiting card + add player avatar wall"
```

(If you didn't modify `gameStore.ts` or `useSocket.ts` because the store already tracked `lobbyPlayers`, omit those paths from the `git add`.)

---

### Task 3: Create the host-screen skeleton primitive (`HostScreenShell`)

**Files:**
- Create: `packages/host/src/ui/HostScreenShell.tsx`
- Modify: `packages/host/src/ui/index.ts`

Goal: build the consistent host-screen skeleton (spec §7.3): location top-left, time-left top-right (dimmed/optional), centred content, optional player-tracker slot at the bottom. Dashboard consumes it next; every other host screen (Phases 4–10) will too.

- [ ] **Step 1: Create `packages/host/src/ui/HostScreenShell.tsx`**

```tsx
import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

interface TimeLeftSlotProps {
  /** Number of seconds remaining, or `null` to render the dimmed "—:—" placeholder. */
  seconds: number | null;
  /** When `true` (default for Dashboard), the slot renders fully dimmed regardless of `seconds`. */
  dimmed?: boolean;
}

/** Top-right time-left slot. Same component, same place, every host screen.
 *  Dashboard passes `dimmed` and a `null` value so the slot reads "—:—" muted. */
function TimeLeftSlot({ seconds, dimmed = false }: TimeLeftSlotProps) {
  const label =
    seconds == null
      ? '—:—'
      : seconds < 60
        ? `${seconds.toString().padStart(2, '0')}s`
        : `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  return (
    <div
      className={[
        'flex min-w-[8rem] items-center justify-center rounded-2xl border-2 border-ink bg-bg-surface px-4 py-2 shadow-ink-sm',
        'font-display text-2xl font-black leading-none tracking-tight text-ink',
        dimmed ? 'opacity-40' : '',
      ].join(' ')}
      role="timer"
      aria-label={seconds == null ? 'No active timer' : `${seconds} seconds remaining`}
    >
      {label}
    </div>
  );
}

interface HostScreenShellProps {
  /** Top-left location label, e.g. "Host Dashboard · Lobby" or "Quiz Round · Question 7 of 15". Spelled out, no abbreviations. */
  location: string;
  /** Top-right slot. By default renders the time-left panel; pass `'theme-toggle'` to replace it with the theme toggle (Dashboard does this per spec §5.6). */
  topRight?:
    | { kind: 'time-left'; seconds: number | null; dimmed?: boolean }
    | { kind: 'theme-toggle' };
  /** Centred content. */
  children: ReactNode;
  /** Optional bottom slot. Per spec §7.3 this is reserved for the player tracker on every game screen — and nothing competes with it above. */
  footer?: ReactNode;
}

export function HostScreenShell({ location, topRight, children, footer }: HostScreenShellProps) {
  const top = topRight ?? { kind: 'time-left', seconds: null, dimmed: true };
  return (
    <div className="flex min-h-screen flex-col bg-bg-base text-ink">
      <header className="flex items-center justify-between gap-4 border-b-2 border-ink/10 px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
            Host
          </div>
          <div className="truncate font-display text-xl font-black tracking-tight text-ink sm:text-2xl">
            {location}
          </div>
        </div>
        <div className="shrink-0">
          {top.kind === 'theme-toggle'
            ? <ThemeToggle />
            : <TimeLeftSlot seconds={top.seconds} dimmed={top.dimmed} />}
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        {children}
      </main>

      {footer && (
        <footer className="border-t-2 border-ink/10 px-6 py-4">
          {footer}
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export it from the host UI barrel**

Edit `packages/host/src/ui/index.ts`. Add at the bottom (before any trailing newline):

```ts
export { HostScreenShell } from './HostScreenShell';
```

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/ui/HostScreenShell.tsx packages/host/src/ui/index.ts
git commit -m "feat(host/ui): add HostScreenShell skeleton (location · time-left · content · footer)"
```

---

### Task 4: Create the `PlayerTracker` primitive

**Files:**
- Create: `packages/host/src/ui/PlayerTracker.tsx`
- Modify: `packages/host/src/ui/index.ts`

Goal: build the scrollable connected-players list with live scores. Used in Dashboard right column now; will be re-used in every per-game host display in Phases 4–10 (as the "player tracker" at the bottom of each host screen).

- [ ] **Step 1: Create `packages/host/src/ui/PlayerTracker.tsx`**

```tsx
import { motion } from 'framer-motion';
import { Avatar } from './Avatar';
import { Chip } from './Chip';

export interface TrackedPlayer {
  id: string;
  name: string;
  /** Connection status. Disconnected players render dimmed but still appear in the list. */
  connected: boolean;
  /** Optional score. Hidden when omitted (lobby phase). */
  score?: number;
  /** Optional per-player status chip — used by per-game host displays in later phases (e.g. "answered", "guess 3 of 6"). */
  status?: string;
  /** Optional explicit highlight (e.g. current player on their turn). */
  highlight?: boolean;
}

interface PlayerTrackerProps {
  players: TrackedPlayer[];
  /** Heading shown above the list. Spec §7.3 demands an explicit "X of Y" count. */
  title: string;
  /** When `true`, the list is scrollable with a max height; otherwise it grows. */
  scrollable?: boolean;
  className?: string;
  /** Optional empty-state node (e.g. "Share <url> with players"). */
  emptyState?: React.ReactNode;
}

export function PlayerTracker({
  players,
  title,
  scrollable = true,
  className = '',
  emptyState,
}: PlayerTrackerProps) {
  return (
    <div className={['flex flex-col gap-3', className].join(' ')}>
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">
        {title}
      </div>
      <div
        className={[
          'flex flex-col gap-2 rounded-2xl border-2 border-ink bg-bg-surface p-3 shadow-ink',
          scrollable ? 'max-h-[28rem] overflow-y-auto' : '',
        ].join(' ')}
      >
        {players.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-ink-muted">
            {emptyState ?? 'No players yet.'}
          </div>
        ) : (
          players.map((p) => (
            <motion.div
              key={p.id}
              layout
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className={[
                'flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2',
                p.highlight
                  ? 'border-ink bg-now text-on-now'
                  : p.connected
                    ? 'border-ink bg-bg-base text-ink'
                    : 'border-ink/30 bg-bg-sunken text-ink-muted opacity-60',
              ].join(' ')}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={p.name} size="sm" />
                <span className="truncate text-base font-bold">{p.name}</span>
                {p.status && (
                  <Chip variant="muted" className="ml-1">{p.status}</Chip>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {typeof p.score === 'number' && (
                  <span className="font-display text-lg font-black leading-none tracking-tight">
                    {p.score}
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from the host UI barrel**

Edit `packages/host/src/ui/index.ts`. Add:

```ts
export { PlayerTracker } from './PlayerTracker';
export type { TrackedPlayer } from './PlayerTracker';
```

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/ui/PlayerTracker.tsx packages/host/src/ui/index.ts
git commit -m "feat(host/ui): add PlayerTracker (scrollable connected-players list)"
```

---

### Task 5: Migrate the Dashboard login (password gate) screen

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

Goal: replace **only the login branch** (the `if (!authenticated) { return (...) }` block, lines 373–461 of the current Dashboard). Leave the post-auth control-panel branch unchanged in this task — it gets a full rebuild in Tasks 6–7 so the diff stays reviewable.

The new login screen:
- Wraps in `HostScreenShell` with `location="Host Login"` and `topRight={{ kind: 'theme-toggle' }}` (per spec §5.6 the toggle replaces the time-left slot on the Dashboard)
- Uses a single centred `Card` (drops the marketing "Run the Room" left column — not in spec; replaces with a tight focused login)
- `Input` with `type="password"`, `Pill` for the server-connection state, `Button` for submit

- [ ] **Step 1: Add the new imports at the top of `packages/host/src/screens/Dashboard.tsx`**

After the existing `import { io, Socket } from 'socket.io-client';` line, add:

```ts
import { Button, Card, HostScreenShell, Input, Pill } from '../ui';
import { screenEnter } from '../lib/motion';
```

- [ ] **Step 2: Replace the `if (!authenticated) { return (...) }` block**

Find the block that starts with `if (!authenticated) {` (around line 373) and ends with the closing `);` before the unauthenticated branch's closing brace (around line 461). Replace it entirely with:

```tsx
  if (!authenticated) {
    const status: 'connected' | 'connecting' | 'offline' = connected
      ? 'connected'
      : 'connecting';
    return (
      <HostScreenShell
        location="Host Login"
        topRight={{ kind: 'theme-toggle' }}
      >
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <motion.div variants={screenEnter} initial="hidden" animate="visible">
            <Card eyebrow="Host Station" title="Run the Room">
              <p className="mb-5 text-base leading-relaxed text-ink-muted">
                Use the host password to unlock controls for the current session.
              </p>

              <div className="mb-5">
                <Pill status={status}>
                  {connected ? 'Connected to server' : 'Connecting to server'}
                </Pill>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <Input
                  label="Host Password"
                  type="password"
                  placeholder="Enter host password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!connected}
                  error={error || undefined}
                />
                <Button
                  type="submit"
                  variant="action"
                  size="lg"
                  disabled={!connected || !password}
                  className="w-full"
                >
                  Unlock Host Controls
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </HostScreenShell>
    );
  }
```

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Visually verify the login screen**

```bash
cd packages/host
npm run dev
```
Open http://localhost:5174. Verify:
1. Header shows `Host · Host Login` top-left, `ThemeToggle` top-right.
2. A single centred Card with eyebrow "Host Station", title "Run the Room", connection Pill, password Input, large green "Unlock Host Controls" Button.
3. Toggle theme — colors flip.
4. Type a wrong password, submit — the Input's error helper shows the server's rejection message in danger red.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "feat(host): redesign Dashboard login screen with HostScreenShell + primitives"
```

---

### Task 6: Migrate the Dashboard control-panel chrome (shell, QR card, player tracker) + drop deprecated panels

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

Goal: replace the **outer chrome** of the post-auth Dashboard (lines 463–488 + 781–862 of the current file) — the page wrapper, header bar, the Championship Table, and the Quick Guide. Also remove the Live Game panel (lines 493–551) which duplicates Display per spec §7.3.

This task lays down the **3-column grid scaffold** (`QR card · launcher area · player tracker`). The launcher area still contains the **existing** game-controls JSX (legacy classes) — that gets replaced in Task 7. This keeps each commit reviewable.

- [ ] **Step 1: Replace the post-auth `return (...)` block**

Find the post-auth `return (...)` that starts at `return (` followed by `<div className="screen-shell">` (around line 463) and ends with the matching closing `);` (around line 866). Replace the entire post-auth return with:

```tsx
  const status: 'connected' | 'connecting' | 'offline' = connected ? 'connected' : 'offline';
  const connectedCount = players.filter((p) => p.connected).length;
  const totalCount = players.length;

  // Build the player tracker rows. Sort: highest score first, except Pointless which sorts low-first.
  const sortedPlayers = [...players].sort((a, b) =>
    gameState?.currentGame === 'pointless'
      ? a.score - b.score
      : b.score - a.score,
  );
  const trackerPlayers: TrackedPlayer[] = sortedPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
    score: gameState?.phase === 'lobby' ? undefined : p.score,
    status:
      gameState?.phase === 'lobby' && p.connected
        ? 'Ready'
        : undefined,
  }));

  return (
    <HostScreenShell
      location={`Host Dashboard · ${gameState?.phase === 'lobby' ? 'Lobby' : gameState?.phase === 'leaderboard' ? 'Leaderboard' : 'Playing'}`}
      topRight={{ kind: 'theme-toggle' }}
    >
      <motion.div variants={screenEnter} initial="hidden" animate="visible" className="flex flex-col gap-4">
        {/* Header strip — session state + logout */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill status={status}>
              {connected ? 'Live' : 'Reconnecting'}
            </Pill>
            <Chip variant="info">{`${connectedCount} of ${totalCount} players connected`}</Chip>
            {gameState?.currentGame && (
              <Chip variant="muted">{`Current game · ${GAME_LABELS[gameState.currentGame as GameKey] ?? gameState.currentGame}`}</Chip>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* 3-column body: QR · launcher · player tracker */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">

          {/* LEFT: QR + URL card */}
          <Card eyebrow="Join the Room" title="Scan to play">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-2xl border-2 border-ink bg-white p-3 shadow-ink">
                <QRCodeSVG value={PLAYER_URL} size={200} bgColor="#ffffff" fgColor="#181614" />
              </div>
              <div className="w-full break-words rounded-xl border-2 border-ink bg-bg-sunken px-3 py-2 text-center font-display text-base font-black tracking-tight text-ink">
                {playerJoinLabel}
              </div>
              <p className="text-xs text-ink-muted">
                Players join from any device on the same network.
              </p>
            </div>
          </Card>

          {/* MIDDLE: launcher area — REBUILT IN TASK 7. For now, keep the existing legacy JSX so the build keeps working. */}
          <div className="card lg:col-span-1" data-phase3-legacy-launcher>
            {/* === LEGACY GAME-CONTROLS BLOCK (Task 7 replaces this) ===
                Copy lines 555–710 from the original Dashboard.tsx — everything from
                  <p className="eyebrow mb-3">Session Controls</p>
                through the closing `</div>` of the "Reset Game" sm:col-span-2 button row.
                Wrap in this `<div className="card">` for now.
                Do not delete the championship and lobby/skip/reset buttons.
            */}
          </div>

          {/* RIGHT: player tracker */}
          <PlayerTracker
            title={`Players · ${connectedCount} of ${totalCount} connected`}
            players={trackerPlayers}
            emptyState={(
              <>
                No players yet.
                <br />
                Share <span className="font-bold text-ink">{playerJoinLabel}</span> with players.
              </>
            )}
          />
        </div>
      </motion.div>
    </HostScreenShell>
  );
```

Important: keep the existing legacy game-controls JSX **inline** in the middle column for this task — copy the block from the **old** file (the `<div className="card lg:col-span-2">` ... that contains "Session Controls", championship mode, single-game buttons, championship continue button, pointless controls, and the lobby/skip/reset row) and paste it inside the new `<div className="card lg:col-span-1" data-phase3-legacy-launcher>` placeholder. Strip only the outer `<div className="card lg:col-span-2">` wrapper — the inner contents (the `<p className="eyebrow">`, the `<h2>`, the championship mode div, etc.) stay as-is. This keeps the build green; Task 7 replaces the inner contents.

- [ ] **Step 2: Import `TrackedPlayer` and `PlayerTracker`**

Update the import line added in Task 5 to include `PlayerTracker` and the new `Chip`:

```ts
import { Button, Card, Chip, HostScreenShell, Input, Pill, PlayerTracker } from '../ui';
import type { TrackedPlayer } from '../ui';
import { screenEnter } from '../lib/motion';
import { QRCodeSVG } from 'qrcode.react';
```

(The `Input` is still needed for the login branch added in Task 5. `QRCodeSVG` is new — add it.)

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds. The post-auth screen now has the new shell + QR card + player tracker on the right, with the legacy launcher in the middle.

- [ ] **Step 4: Visually verify**

```bash
cd packages/host
npm run dev
```
1. Log in. Confirm header strip shows connection Pill + connected-count Chip + Logout button.
2. The body is three columns: QR card (left), legacy launcher (middle), PlayerTracker (right).
3. Join a player from another tab — they appear in the right column with their avatar, sliding in via the `layout` animation.
4. Toggle theme — every part of the screen flips.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "feat(host): wrap Dashboard control panel in HostScreenShell + add QR card + PlayerTracker; drop Live Game, Championship Table, Quick Guide panels"
```

---

### Task 7: Migrate the Dashboard launcher (4×2 grid + secondary row)

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

Goal: replace the legacy launcher block (inside the `<div className="card lg:col-span-1" data-phase3-legacy-launcher>` placeholder from Task 6) with the spec's **4×2 game-launch grid + secondary row for Championship Sequence + Reset**, all using `Button` primitives. Championship mode is a toggle that swaps the grid for a checkbox selector + Start Championship button.

- [ ] **Step 1: Replace the entire content of the `<div data-phase3-legacy-launcher>` block**

Replace the legacy-launcher placeholder div with this:

```tsx
          {/* MIDDLE: launcher area */}
          <Card eyebrow="Session Controls" title={championshipMode ? 'Pick games for the Championship Sequence' : 'Start a game'}>
            <div className="flex flex-col gap-5">

              {/* Championship mode toggle */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-ink bg-bg-sunken px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-muted">Mode</div>
                  <div className="font-display text-lg font-black tracking-tight text-ink">
                    {championshipMode ? 'Championship Sequence' : 'Single Round'}
                  </div>
                </div>
                <Button
                  variant={championshipMode ? 'premium' : 'ghost'}
                  size="sm"
                  onClick={() => setChampionshipMode((m) => !m)}
                  disabled={gameState?.phase !== 'lobby'}
                >
                  {championshipMode ? 'Switch to Single Round' : 'Switch to Championship'}
                </Button>
              </div>

              {/* Championship view: checkbox grid + start button */}
              {championshipMode ? (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {availableGames.map((game) => {
                      const selected = selectedGames.has(game.id);
                      return (
                        <Button
                          key={game.id}
                          variant={selected ? 'info' : 'ghost'}
                          size="sm"
                          onClick={() => toggleGameSelection(game.id)}
                          disabled={gameState?.phase !== 'lobby'}
                          aria-pressed={selected}
                          className="!justify-start text-left"
                        >
                          <span aria-hidden="true" className="mr-2">{selected ? '✓' : '○'}</span>
                          {game.name}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="premium"
                    size="lg"
                    onClick={startChampionship}
                    disabled={gameState?.phase !== 'lobby' || selectedGames.size === 0}
                    className="w-full"
                  >
                    Start Championship · {selectedGames.size} {selectedGames.size === 1 ? 'game' : 'games'}
                  </Button>
                </>
              ) : (
                /* Single-round view: 4×2 grid of game launches */
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {LAUNCH_GAMES.map((g) => (
                    <Button
                      key={g.id}
                      variant={g.variant}
                      size="md"
                      onClick={() => startGame(g.id)}
                      disabled={gameState?.phase !== 'lobby'}
                      className="!justify-start text-left"
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Championship continue */}
              {gameState?.phase === 'leaderboard' && championshipActive && (
                <div className="rounded-2xl border-2 border-ink bg-now/40 px-4 py-3">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-ink">
                    Championship in progress
                  </div>
                  <Button variant="now" size="lg" onClick={nextChampionshipGame} className="w-full">
                    Continue to next round
                  </Button>
                </div>
              )}

              {/* Pointless reveal */}
              {gameState?.currentGame === 'pointless' && pointlessReadyToReveal && (
                <Button variant="streak" size="lg" onClick={revealResults} className="w-full">
                  Reveal Pointless results
                </Button>
              )}

              {/* Secondary row: Lobby / Emergency Skip / Reset */}
              <div className="grid grid-cols-1 gap-2 border-t-2 border-ink/10 pt-4 sm:grid-cols-3">
                <Button
                  variant="info"
                  size="sm"
                  onClick={returnToLobby}
                  disabled={gameState?.phase === 'lobby'}
                >
                  Return to Lobby
                </Button>
                <Button
                  variant="now"
                  size="sm"
                  onClick={emergencySkip}
                  disabled={gameState?.phase === 'lobby' || gameState?.phase === 'leaderboard'}
                >
                  Emergency Skip
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={resetGame}
                >
                  Reset Game
                </Button>
              </div>
            </div>
          </Card>
```

- [ ] **Step 2: Add the `LAUNCH_GAMES` constant**

The single-round grid (4×2 of 8 games) needs a label + variant for each game. Add this **at module scope** (just below the existing `GAME_LABELS` constant, around line 47):

```tsx
import type { ButtonVariant } from '../ui';

const LAUNCH_GAMES: Array<{ id: GameKey; label: string; variant: ButtonVariant }> = [
  { id: 'quiz',      label: 'Quiz',           variant: 'info'    },
  { id: 'trueFalse', label: 'True or False',  variant: 'action'  },
  { id: 'pointless', label: 'Pointless',      variant: 'streak'  },
  { id: 'pokedle',   label: 'Pokédle',        variant: 'now'     },
  { id: 'hpdle',     label: 'HP-dle',         variant: 'premium' },
  { id: 'numbers',   label: 'Numbers Round',  variant: 'action'  },
  { id: 'wordle',    label: 'Wordle',         variant: 'info'    },
  { id: 'travel',    label: 'Travel',         variant: 'streak'  },
];
```

The `ButtonVariant` import folds into the existing UI import line:

```ts
import { Button, Card, Chip, HostScreenShell, Input, Pill, PlayerTracker } from '../ui';
import type { ButtonVariant, TrackedPlayer } from '../ui';
```

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: End-to-end smoke test**

In three terminals:
```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/host && npm run dev
# Terminal 3
cd packages/client && npm run dev
```

1. Open host at http://localhost:5174 — log in.
2. Confirm the launcher shows the 4×2 grid of all eight games, each in their assigned color variant; the secondary row shows three smaller buttons (Lobby / Skip / Reset).
3. Click "Switch to Championship" — the launcher swaps to checkbox-style buttons; the Start Championship plum button appears at the bottom.
4. Open the client at http://localhost:5173 — join two players. Confirm they appear in the right-column PlayerTracker with avatars + names. Confirm the connected-count Chip in the header strip updates to "2 of 2".
5. Click "Start Quiz" — the host should successfully start the game; check the Display screen (Ctrl+D) still works as before (Display is unchanged by this PR).
6. Return to Dashboard (Ctrl+D again) — verify "Return to Lobby" button works and clears.
7. Toggle theme — every part flips. Reload — theme persists.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "feat(host): redesign Dashboard launcher (4×2 grid + Championship + secondary controls)"
```

---

### Task 8: Tighten the Dashboard — remove stale `GAME_LABELS` references + dead helpers

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

Goal: with the deprecated panels (Live Game, Championship Table, Quick Guide) gone in Task 6, several pieces of state and a couple of helpers are now unused. Clean them up so the file is honest about what it does.

- [ ] **Step 1: Identify dead code**

Open `packages/host/src/screens/Dashboard.tsx`. The following are now unused and should be removed:

- The `championshipPlayers` derived array (used only by the deleted Championship Table)
- The `activeGame` constant if it is now only referenced as `gameState?.currentGame` in the Pointless / lobby labels (keep if it is still referenced; remove otherwise)
- The `liveData`, `setLiveData`, `answeredPlayers`, `setAnsweredPlayers`, `timeRemaining`, `setTimeRemaining`, `totalTime`, `setTotalTime`, `timerEndsAt`, `setTimerEndsAt` state hooks **and** their effect — they only powered the deleted Live Game panel
- All `newSocket.on('quiz:question:start', ...)`, `'truefalse:statement'`, `'countdown:round:start'`, `'pointless:round:start'`, `'host:player_answered'`, `'quiz:question:end'`, `'truefalse:answer'`, `'countdown:round:end'`, `clearLive` listeners — these populated the deleted Live Game panel
- **Keep** `'pointless:round:end'` because it still sets `pointlessReadyToReveal` for the Pointless reveal button
- **Keep** `'session:end'` and `'host:control:success'` because they still manage `championshipActive` and `pointlessReadyToReveal`
- **Keep** the timer cleanup useEffect only if `timerEndsAt` survives the cull — if not, remove that effect too

Do **not** remove the `GAME_LABELS` constant — it's used by the connected-game Chip in the header strip.

- [ ] **Step 2: Apply the cleanup**

Delete the identified state hooks, the `useEffect` that polls `timerEndsAt`, the dead socket listeners, and the `championshipPlayers` block. Re-run TypeScript to confirm nothing else references them. If the TypeScript compiler complains about an unused import, remove it too.

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds, no TypeScript "declared but never read" warnings.

- [ ] **Step 4: Smoke test**

```bash
cd packages/host
npm run dev
```
Start the server and a client too. Verify:
1. Dashboard still loads cleanly post-login.
2. Starting a Pointless round and waiting for the timer still surfaces the "Reveal Pointless results" button.
3. Starting a Championship still surfaces the "Continue to next round" button on the leaderboard phase.
4. The connected-count chip and the player tracker still update live.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "refactor(host): remove dead Live Game state and listeners from Dashboard"
```

---

### Task 9: Wire the connected-count + championship countdown into the header chip strip

**Files:**
- Modify: `packages/host/src/screens/Dashboard.tsx`

Goal: small polish pass — make the header strip and PlayerTracker title obey spec §7.3 ("explicit X of Y count") and add a Championship Sequence progress chip when the championship is running. This is a small but spec-required nicety.

- [ ] **Step 1: Track championship progress from `gameState`**

Inside the Dashboard component, near where `championshipActive` is read, derive a count if the gameState includes championship metadata. If `gameState.championship?.completedGames` and `gameState.championship?.totalGames` are available (search the gameStore / server to confirm; if not, just gate on `championshipActive`), use them. Add:

```tsx
const championshipCompleted = gameState?.championship?.completedGames as number | undefined;
const championshipTotal = gameState?.championship?.totalGames as number | undefined;
```

- [ ] **Step 2: Update the header chip strip**

In the header strip JSX added in Task 6 (the row above the 3-column grid), replace the `Chip variant="info"` for connected players with this expanded version:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <Pill status={status}>
    {connected ? 'Live' : 'Reconnecting'}
  </Pill>
  <Chip variant="info">{`${connectedCount} of ${totalCount} players connected`}</Chip>
  {gameState?.currentGame && (
    <Chip variant="muted">{`Current game · ${GAME_LABELS[gameState.currentGame as GameKey] ?? gameState.currentGame}`}</Chip>
  )}
  {championshipActive && typeof championshipCompleted === 'number' && typeof championshipTotal === 'number' && (
    <Chip variant="streak">{`Championship · game ${championshipCompleted + 1} of ${championshipTotal}`}</Chip>
  )}
</div>
```

(If the championship metadata doesn't exist on `gameState`, the conditional gracefully falls back to no chip; the chip just doesn't show.)

- [ ] **Step 3: Verify the build**

```bash
cd packages/host
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/host/src/screens/Dashboard.tsx
git commit -m "feat(host): add Championship Sequence progress chip to Dashboard header"
```

---

### Task 10: End-to-end verification + cross-theme sweep

**Files:** none modified.

- [ ] **Step 1: Build both apps**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```
Expected: both builds succeed with no TypeScript errors and no warnings about unresolved Tailwind classes.

- [ ] **Step 2: Run the client test suite**

```bash
cd packages/client
npm run test:run
```
Expected: the existing ThemeProvider tests still pass; no new failures.

- [ ] **Step 3: Full smoke run**

In three terminals:
```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/host && npm run dev
# Terminal 3
cd packages/client && npm run dev
```

Walk through every Phase 3 user flow:

**Player Lobby:**
1. Open http://localhost:5173 (Player A).
2. Pre-join: confirm Card chrome, connection Pill, big green Join button.
3. Toggle theme via the top-right toggle. Reload — theme persists.
4. Join the room. Confirm the waiting Card with large Avatar + "Ready" chip.
5. Open http://localhost:5173 in a second tab (Player B). Join.
6. Both tabs show two avatars in the "In the room" Card; B's avatar pops in.
7. Toggle theme on each tab independently — they don't affect each other (independent localStorage).

**Host Dashboard:**
8. Open http://localhost:5174 — log-in screen renders with `HostScreenShell` chrome and the centred login Card.
9. Log in with the dev password. Post-auth Dashboard renders.
10. Verify: header strip shows connection Pill (Live) + `2 of 2 players connected` Chip; QR card on left, launcher in the middle, PlayerTracker on the right.
11. Scan the QR with a phone (or just type the URL) and confirm it points to the player join URL.
12. Click "Start Quiz" — Display screen still works as before. Return to Dashboard (Ctrl+D).
13. Click "Return to Lobby" — Dashboard returns to lobby phase.
14. Click "Switch to Championship" — launcher swaps to the checkbox-style grid; "Start Championship" plum button appears.
15. Start a 2-game championship. Confirm the "Championship · game 1 of 2" Chip appears in the header. After the first game ends, confirm the "Continue to next round" button appears in the launcher area.
16. Confirm the PlayerTracker on the right is sorted by score (or by ascending score during Pointless rounds).
17. Toggle theme — every Dashboard region flips. Reload — theme persists.

**Cross-screen regression check:**
18. Confirm no other screen has visually regressed. Specifically check: Quiz, TrueFalse, Wordle, Pointless, Numbers, ThemedDle, Travel, FinalLeaderboard, Countdown — these all still use the legacy `index.css` rules and should look identical to before this PR.

- [ ] **Step 4: prefers-reduced-motion spot-check**

In Chrome DevTools, open Rendering tab → set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Reload the Lobby and Dashboard. Verify:
- No transform-based animations on the avatar-wall pop-in (the framer-motion variants should still fire — full reduced-motion substitutions are a Phase 11 task, but nothing should be broken)
- Theme flip has no transition (the `*` rule in `tokens.css` disables transitions under `prefers-reduced-motion`)

This is a "nothing broken" check, not a full audit. The full reduced-motion substitution pass is Phase 11.

- [ ] **Step 5: Confirm a clean working tree**

```bash
git status
```
Expected: "nothing to commit, working tree clean." No new untracked files unless they're intended.

---

## Done criteria

All of the following must be true before this plan is considered complete:

- [ ] `npm run build` succeeds in both `packages/client` and `packages/host`
- [ ] `npm run test:run` in `packages/client` still passes (6 ThemeProvider tests)
- [ ] Player Lobby renders in the new design language in both pre-join and post-join states, in both themes, with the avatar wall populating as players join
- [ ] Host Dashboard renders in the new design language in both the login and control-panel states, in both themes
- [ ] Dashboard layout matches spec §7.3: location top-left · ThemeToggle top-right · 3-column body (QR card · launcher · PlayerTracker) · no Live Game panel · no Championship Table panel · no Quick Guide panel
- [ ] Dashboard launcher is a 4×2 grid of game-start buttons (single-round mode) and a checkbox-style grid + Start Championship button (championship mode), plus a secondary row with Lobby / Emergency Skip / Reset
- [ ] `HostScreenShell` is exported from `packages/host/src/ui` and consumed by both Dashboard sub-screens; ready for re-use in Phases 4–10
- [ ] `PlayerTracker` is exported from `packages/host/src/ui` and consumed by the post-auth Dashboard; ready for re-use in Phases 4–10
- [ ] Pre-existing screens (Quiz, Wordle, Pointless, etc.) have **no visual regression** — they still use the legacy `index.css` rules and look identical to before this plan
- [ ] No legacy `index.css` rules or deprecated Tailwind tokens have been removed — those are Phase 11
- [ ] Theme toggle persists per-app in `localStorage`; player and host have independent themes

---

## Out-of-scope notes flagged for follow-up

These were spotted while migrating but are intentionally **not** addressed in this plan:

1. **Dashboard's old Live Game panel is removed.** It duplicated the Display screen's responsibility and isn't in spec §7.3's Dashboard layout. If the host needs an "answer tracker" on the Dashboard side too, that's a future change with its own design discussion.
2. **Championship Table is moved off the Dashboard.** Per spec §7.3 it isn't a Dashboard concern; live standings already live in the FinalLeaderboard (Phase 4) and per-game leaderboard overlays. If the host wants a live standings strip during play, propose it for Phase 4.
3. **Quick Guide three-tile panel** is removed — marketing copy with no functional value.
4. **The Lobby's `lobbyPlayers` slice** is a small addition to `gameStore`. If the existing socket layer already broadcasts something equivalent under a different name, Task 2 Step 1 lets you reuse it instead of duplicating.
5. **Dashboard is still a 600+ line file even after this plan.** A future cleanup PR could split it into `DashboardLogin.tsx`, `DashboardControls.tsx`, and `DashboardLauncher.tsx`. Out of scope here — would balloon the diff.
