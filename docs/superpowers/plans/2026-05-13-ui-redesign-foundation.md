# PHoG UI Redesign — Foundation + Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation (CSS-variable tokens, theme provider, motion utilities, Google Fonts) and the complete primitives library (Button, Input, Card, Chip, Pill, Tile, Avatar, LeaderboardRow, Countdown, ScoreDrop, ThemeToggle) for the PHoG UI redesign. No existing screens are migrated; all changes are purely additive — every game keeps working unchanged after this plan ships.

**Architecture:** Tokens are CSS custom properties scoped by `[data-theme="light|dark"]`, defined once in `ui/tokens.css`. Tailwind's `theme.extend` references those variables so classes like `bg-action` work in both themes for free. A small inline script in `index.html` sets `data-theme` before React mounts to avoid flash. A React `ThemeProvider` reads the initial state, persists changes to `localStorage`, and follows `prefers-color-scheme` live until the user toggles. Primitives are leaf React components that consume Tailwind classes (never raw hex values). The same `ui/` + `lib/` tree is duplicated under `packages/client` and `packages/host` per the spec — duplication is cheaper than a new workspace package for ~15 files.

**Tech stack:** React 18 · TypeScript 5.3 · Tailwind 3.4 (existing) · framer-motion 10 (existing) · Vitest + jsdom + React Testing Library (new, client-only, for theme-provider logic) · Google Fonts CDN (Inter, Inter Tight, Fraunces — new).

**Spec reference:** [docs/superpowers/specs/2026-05-13-ui-redesign-design.md](../specs/2026-05-13-ui-redesign-design.md)

**Out of scope for this plan:**
- Migrating any existing screen (Lobby, Quiz, Wordle, etc.) — those are Phases 3–11 in the spec, each with its own follow-up plan
- Removing old `index.css` rules or deprecated Tailwind tokens — kept alive so existing screens keep rendering until they're migrated
- Audio, server-side, new game logic

---

## File map

**Client (`packages/client/`):**
- `package.json` — add Vitest + RTL devDeps, add `test` and `test:run` scripts
- `vitest.config.ts` — *create*
- `src/test-setup.ts` — *create*
- `index.html` — add anti-flash inline `<script>`
- `tailwind.config.js` — rewrite to consume CSS vars and add font/shadow tokens
- `src/index.css` — add Google Fonts `@font-face` imports and `@import './ui/tokens.css'`
- `src/ui/tokens.css` — *create* (full light + dark token table)
- `src/ui/Button.tsx` — *create*
- `src/ui/Input.tsx` — *create*
- `src/ui/Card.tsx` — *create*
- `src/ui/Chip.tsx` — *create*
- `src/ui/Pill.tsx` — *create*
- `src/ui/Tile.tsx` — *create*
- `src/ui/Avatar.tsx` — *create*
- `src/ui/LeaderboardRow.tsx` — *create*
- `src/ui/Countdown.tsx` — *create*
- `src/ui/ScoreDrop.tsx` — *create*
- `src/ui/ThemeToggle.tsx` — *create*
- `src/ui/UiShowcase.tsx` — *create* (visual QA page, behind `?showcase` query param)
- `src/ui/index.ts` — *create* (barrel exports)
- `src/lib/theme.tsx` — *create* (ThemeProvider + `useTheme`)
- `src/lib/theme.test.tsx` — *create*
- `src/lib/motion.ts` — *create*
- `src/main.tsx` — wrap `<App />` in `<ThemeProvider>`
- `src/App.tsx` — add `?showcase` query-param branch (renders `UiShowcase`)

**Host (`packages/host/`):** mirrors of client files. ThemeProvider tests are not duplicated.
- `index.html` — add anti-flash inline `<script>`
- `tailwind.config.js` — rewrite
- `src/index.css` — fonts + token import
- `src/ui/*` — all 12 primitives + `UiShowcase` + `index.ts`
- `src/lib/theme.tsx`, `src/lib/motion.ts`
- `src/main.tsx`, `src/App.tsx` — same modifications as client

---

## Tasks

### Task 1: Add Vitest + jsdom + React Testing Library to the client package

**Files:**
- Modify: `packages/client/package.json`
- Create: `packages/client/vitest.config.ts`
- Create: `packages/client/src/test-setup.ts`

- [ ] **Step 1: Install dev dependencies**

```bash
cd packages/client
npm install --save-dev vitest@^1.6.0 jsdom@^24.0.0 @testing-library/react@^14.3.0 @testing-library/jest-dom@^6.4.0 @testing-library/user-event@^14.5.0
```

Expected: packages installed, no peer-dep errors. Verify with `npm ls vitest` showing `vitest@1.x.x`.

- [ ] **Step 2: Add test scripts to `packages/client/package.json`**

Edit the `"scripts"` block to include the two new scripts (preserve the existing `dev`, `build`, `preview`):

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 3: Create `packages/client/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Create `packages/client/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Run the test runner against an empty suite**

Run from `packages/client`:
```bash
npm run test:run
```
Expected: "No test files found" but exit code 0 (Vitest treats no-tests as success by default; if it exits non-zero, add `passWithNoTests: true` to the `test` block in `vitest.config.ts`).

- [ ] **Step 6: Commit**

```bash
git add packages/client/package.json packages/client/package-lock.json packages/client/vitest.config.ts packages/client/src/test-setup.ts
git commit -m "chore(client): add vitest + jsdom + RTL for theme-provider tests"
```

---

### Task 2: Create the design tokens stylesheet

**Files:**
- Create: `packages/client/src/ui/tokens.css`

- [ ] **Step 1: Create `packages/client/src/ui/tokens.css`**

```css
/* PHoG design tokens — light + dark themes
 * Components reference roles (e.g. var(--action)), not raw hex values.
 * See docs/superpowers/specs/2026-05-13-ui-redesign-design.md §2.1 */

:root[data-theme="light"] {
  /* Surfaces */
  --bg-base:    #fdf6e8;
  --bg-surface: #ffffff;
  --bg-sunken:  #f2e9d4;

  /* Ink */
  --ink:        #181614;
  --ink-muted:  #4a3f33;
  --shadow:     #181614;

  /* Semantic */
  --action:     #2ec27e;
  --now:        #ffd23f;
  --info:       #4a7adf;
  --streak:     #d96a3a;
  --premium:    #5b3a5b;
  --danger:     #e54848;
  --warn:       #f59e0b;

  /* Answer letter colors (Quiz / TrueFalse) */
  --answer-a:   #4a7adf;
  --answer-b:   #2ec27e;
  --answer-c:   #ffd23f;
  --answer-d:   #5b3a5b;

  /* Medals */
  --medal-gold:   #e0b94a;
  --medal-silver: #b9b0a3;
  --medal-bronze: #b8714a;

  /* Foreground over each color (for accessible contrast) */
  --on-action:  #ffffff;
  --on-now:     #181614;
  --on-info:    #ffffff;
  --on-streak:  #ffffff;
  --on-premium: #ffffff;
  --on-danger:  #ffffff;
}

:root[data-theme="dark"] {
  /* Surfaces */
  --bg-base:    #131013;
  --bg-surface: #1f1b1a;
  --bg-sunken:  #171313;

  /* Ink */
  --ink:        #fdf6e8;
  --ink-muted:  #b4a48b;
  --shadow:     #d96a3a; /* warm terracotta glow on dark */

  /* Semantic (brighter for dark backgrounds) */
  --action:     #3ad286;
  --now:        #ffd23f;
  --info:       #6b95ee;
  --streak:     #e88557;
  --premium:    #7a4f7a;
  --danger:     #ff6b6b;
  --warn:       #ffb84d;

  /* Answer letter colors */
  --answer-a:   #6b95ee;
  --answer-b:   #3ad286;
  --answer-c:   #ffd23f;
  --answer-d:   #7a4f7a;

  /* Medals — same physical color */
  --medal-gold:   #e0b94a;
  --medal-silver: #b9b0a3;
  --medal-bronze: #b8714a;

  /* Foreground over each color */
  --on-action:  #0d0a09;
  --on-now:     #181614;
  --on-info:    #0d0a09;
  --on-streak:  #0d0a09;
  --on-premium: #ffffff;
  --on-danger:  #0d0a09;
}

/* Smooth theme flip — colors/borders/shadows only, NOT transforms or opacity.
 * §5.5 in the spec: avoid laggy mid-animation flips. */
:root {
  color-scheme: light dark;
}
*, *::before, *::after {
  transition:
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    color 180ms ease-out,
    box-shadow 180ms ease-out,
    fill 180ms ease-out,
    stroke 180ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none; }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/ui/tokens.css
git commit -m "feat(client): add design tokens stylesheet (light + dark themes)"
```

---

### Task 3: Rewrite Tailwind config to consume CSS variables

**Files:**
- Modify: `packages/client/tailwind.config.js`

- [ ] **Step 1: Replace the contents of `packages/client/tailwind.config.js`**

Keep the existing tokens (`primary.*`, `game.*`, `answer.*`, etc.) so old `index.css` rules still work — and add the new semantic ones alongside.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== NEW: redesign tokens (consume CSS variables) =====
        'bg-base':    'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-sunken':  'var(--bg-sunken)',
        ink:          'var(--ink)',
        'ink-muted':  'var(--ink-muted)',
        action:       'var(--action)',
        now:          'var(--now)',
        info:         'var(--info)',
        streak:       'var(--streak)',
        premium:      'var(--premium)',
        danger:       'var(--danger)',
        warn:         'var(--warn)',
        'on-action':  'var(--on-action)',
        'on-now':     'var(--on-now)',
        'on-info':    'var(--on-info)',
        'on-streak':  'var(--on-streak)',
        'on-premium': 'var(--on-premium)',
        'on-danger':  'var(--on-danger)',
        'answer-a':   'var(--answer-a)',
        'answer-b':   'var(--answer-b)',
        'answer-c':   'var(--answer-c)',
        'answer-d':   'var(--answer-d)',
        'medal-gold':   'var(--medal-gold)',
        'medal-silver': 'var(--medal-silver)',
        'medal-bronze': 'var(--medal-bronze)',

        // ===== EXISTING (kept so old screens keep working until they're migrated) =====
        primary: {
          navy: '#16110f',
          blue: '#d06d45',
          teal: '#6f9a79',
          purple: '#8b5f6b',
        },
        game: {
          correct: '#6f9a79',
          incorrect: '#bf5c43',
          warning: '#d7a348',
          leader: '#e1c372',
        },
        difficulty: {
          easy: '#6f9a79',
          medium: '#7186be',
          hard: '#d7a348',
          impossible: '#bf5c43',
        },
        answer: {
          A: '#7186be',
          B: '#6f9a79',
          C: '#d7a348',
          D: '#8b5f6b',
        },
        medal: {
          gold: '#d8b25a',
          silver: '#b6aea2',
          bronze: '#ad744c',
        },
        ui: {
          background: '#0f0b09',
          card: '#1d1613',
          border: '#4a392f',
          text: '#f5ecdd',
          textMuted: '#c7b59d',
        }
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'sans-serif'],
        serif:   ['Fraunces', '"Iowan Old Style"', 'serif'],
      },
      boxShadow: {
        'ink-sm': '2px 2px 0 var(--shadow)',
        'ink':    '4px 4px 0 var(--shadow)',
        'ink-lg': '6px 6px 0 var(--shadow)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Verify the build still works**

```bash
cd packages/client
npm run build
```
Expected: build succeeds (the existing screens still consume the old tokens; the new ones are additive).

- [ ] **Step 3: Commit**

```bash
git add packages/client/tailwind.config.js
git commit -m "feat(client): extend Tailwind theme with redesign tokens and font stack"
```

---

### Task 4: Add Google Fonts and import tokens.css

**Files:**
- Modify: `packages/client/src/index.css`

- [ ] **Step 1: Add the Google Fonts import and tokens import at the top of `packages/client/src/index.css`**

The two new lines go at the very top (before the existing `@tailwind` directives):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@700;800;900&family=Fraunces:opsz,wght,SOFT@9..144,700;9..144,800,100&display=swap');
@import './ui/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* (existing content below — leave unchanged) */
```

Leave every other rule in `index.css` exactly as-is. The old `:root` block already sets `color-scheme: dark` — that is overridden by our `[data-theme]` blocks once Task 5's anti-flash script runs, so old screens keep looking the same until they migrate.

- [ ] **Step 2: Boot the dev server and verify**

```bash
cd packages/client
npm run dev
```
Open http://localhost:5173. The Lobby should still render exactly as before. In DevTools → Network, confirm three font files load (Inter, Inter Tight, Fraunces) with status 200.

- [ ] **Step 3: Stop the dev server (Ctrl+C) and commit**

```bash
git add packages/client/src/index.css
git commit -m "feat(client): load Inter + Inter Tight + Fraunces, import design tokens"
```

---

### Task 5: Add the anti-flash inline script to index.html

**Files:**
- Modify: `packages/client/index.html`

- [ ] **Step 1: Add the script in the `<head>` of `packages/client/index.html`**

Place it as the LAST element inside `<head>` (after any existing meta/link tags, before `</head>`). The script must run synchronously before React mounts:

```html
<script>
  (function () {
    var saved = null;
    try { saved = localStorage.getItem('phog-theme'); } catch (_) {}
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

- [ ] **Step 2: Verify in the browser**

```bash
cd packages/client
npm run dev
```
Open http://localhost:5173. In DevTools → Elements, the `<html>` tag should have a `data-theme="light"` (or `"dark"`) attribute set BEFORE the React bundle loads. Toggle your OS theme — reload the page — the attribute should match the OS preference.

- [ ] **Step 3: Stop the dev server and commit**

```bash
git add packages/client/index.html
git commit -m "feat(client): inline anti-flash theme script before React mounts"
```

---

### Task 6: Build the ThemeProvider with TDD

**Files:**
- Create: `packages/client/src/lib/theme.test.tsx`
- Create: `packages/client/src/lib/theme.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/lib/theme.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './theme';

function Probe() {
  const { theme, setTheme, toggle } = useTheme();
  return (
    <div>
      <span data-testid="value">{theme}</span>
      <button onClick={() => setTheme('dark')}>force dark</button>
      <button onClick={() => setTheme('light')}>force light</button>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function setMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: () => {}, // legacy
    removeListener: () => {}, // legacy
    onchange: null,
    dispatchEvent: () => true,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    set(prefersDark2: boolean) {
      mql.matches = prefersDark2;
      listeners.forEach(cb => cb({ matches: prefersDark2 } as MediaQueryListEvent));
    },
  };
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('reads initial theme from the data-theme attribute', () => {
    setMatchMedia(false);
    document.documentElement.setAttribute('data-theme', 'dark');
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('dark');
  });

  it('falls back to prefers-color-scheme when no data-theme is set', () => {
    setMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists setTheme() to localStorage and updates the html attribute', async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('force dark'));
    expect(screen.getByTestId('value').textContent).toBe('dark');
    expect(localStorage.getItem('phog-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggle() flips between light and dark', async () => {
    setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('light');
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('dark');
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('value').textContent).toBe('light');
  });

  it('follows OS theme changes when the user has not committed manually', () => {
    const mq = setMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('value').textContent).toBe('light');
    act(() => mq.set(true));
    expect(screen.getByTestId('value').textContent).toBe('dark');
  });

  it('does NOT follow OS theme changes once the user has set a theme', async () => {
    const mq = setMatchMedia(false);
    const user = userEvent.setup();
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await user.click(screen.getByText('force light'));
    act(() => mq.set(true));
    expect(screen.getByTestId('value').textContent).toBe('light');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/client
npm run test:run -- src/lib/theme.test.tsx
```
Expected: FAIL with "Cannot find module './theme'".

- [ ] **Step 3: Implement the minimal `theme.tsx`**

Create `packages/client/src/lib/theme.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'phog-theme';

function readInitial(): { theme: Theme; manual: boolean } {
  const attr = document.documentElement.getAttribute('data-theme');
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  })();

  if (stored === 'light' || stored === 'dark') {
    return { theme: stored, manual: true };
  }
  if (attr === 'light' || attr === 'dark') {
    return { theme: attr, manual: false };
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return { theme: prefersDark ? 'dark' : 'light', manual: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [{ theme, manual }, setState] = useState(readInitial);

  // Apply the theme to <html> whenever it changes.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Follow OS preference live, but only while the user hasn't committed.
  useEffect(() => {
    if (manual) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setState(prev => prev.manual ? prev : { theme: e.matches ? 'dark' : 'light', manual: false });
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [manual]);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
    setState({ theme: t, manual: true });
  }, []);

  const toggle = useCallback(() => {
    setState(prev => {
      const next: Theme = prev.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return { theme: next, manual: true };
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd packages/client
npm run test:run -- src/lib/theme.test.tsx
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/lib/theme.tsx packages/client/src/lib/theme.test.tsx
git commit -m "feat(client): add ThemeProvider with system-aware default + persistence"
```

---

### Task 7: Wrap the app with ThemeProvider

**Files:**
- Modify: `packages/client/src/main.tsx`

- [ ] **Step 1: Read the existing main.tsx**

Look at `packages/client/src/main.tsx`. It currently renders `<App />` into the root.

- [ ] **Step 2: Wrap `<App />` in `<ThemeProvider>`**

Add the import at the top:

```tsx
import { ThemeProvider } from './lib/theme';
```

Replace the render tree so `<App />` is wrapped:

```tsx
<React.StrictMode>
  <ThemeProvider>
    <App />
  </ThemeProvider>
</React.StrictMode>
```

(If the existing file uses a different wrapper structure, preserve it; just slot `<ThemeProvider>` between `StrictMode` and `App`.)

- [ ] **Step 3: Verify in the browser**

```bash
cd packages/client
npm run dev
```
Open http://localhost:5173. The Lobby should still render exactly as before — no visual change yet, since no component consumes the new tokens. In DevTools → Elements, `<html data-theme="…">` should be present.

- [ ] **Step 4: Stop the dev server and commit**

```bash
git add packages/client/src/main.tsx
git commit -m "feat(client): mount ThemeProvider at the app root"
```

---

### Task 8: Create the motion utilities module

**Files:**
- Create: `packages/client/src/lib/motion.ts`

- [ ] **Step 1: Create `packages/client/src/lib/motion.ts`**

```ts
/* Motion tokens and reusable framer-motion variants.
 * One file so timings can be tuned globally. §4.2 in the spec. */
import type { Variants, Transition } from 'framer-motion';

export const duration = {
  tap: 0.08,
  hover: 0.12,
  toggle: 0.18,
  enter: 0.22,
  reveal: 0.28,
  celebrate: 0.6,
} as const;

export const easing = {
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  backOut: [0.34, 1.56, 0.64, 1] as const,
  springToggle: { type: 'spring', stiffness: 280, damping: 22 } satisfies Transition,
} as const;

export const stagger = {
  short: 0.08,
  tile: 0.18,
  rank: 0.6,
} as const;

/* ---------- Variants ---------- */

export const tap: Variants = {
  rest:    { y: 0, x: 0 },
  pressed: { y: 4, x: 4, transition: { duration: duration.tap, ease: easing.easeOut } },
};

export const hoverLift: Variants = {
  rest:  { y: 0, x: 0 },
  hover: { y: -1, x: -1, transition: { duration: duration.hover, ease: easing.easeOut } },
};

export const popIn: Variants = {
  hidden:  { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: duration.reveal, ease: easing.backOut } },
};

export const tileFlip: Variants = {
  idle:     { rotateX: 0 },
  flipping: { rotateX: [0, 90, 0], transition: { duration: 0.25, times: [0, 0.5, 1], ease: 'easeInOut' } },
};

export const letterDrop: Variants = {
  hidden:  { y: -12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: duration.reveal, ease: easing.easeOut } },
};

export const screenEnter: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.enter, ease: easing.easeOut } },
};

/* Reduced-motion substitute: crossfade only. */
export const reducedFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.toggle } },
};

/* ---------- Pointless score-drop timing (§3.9) ---------- */
export const pointlessDrop = {
  baseMs: 4000,
  msPerPoint: 90,
  landingPauseMs: 1800,
  landingPauseAtZeroMs: 2800,
} as const;

export function pointlessDropDurationMs(dropFromHundred: number): number {
  return pointlessDrop.baseMs + dropFromHundred * pointlessDrop.msPerPoint;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/lib/motion.ts
git commit -m "feat(client): add motion tokens and framer-motion variant library"
```

---

### Task 9: Create the ThemeToggle primitive

**Files:**
- Create: `packages/client/src/ui/ThemeToggle.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/ThemeToggle.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useTheme } from '../lib/theme';
import { easing } from '../lib/motion';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className={
        'relative inline-flex h-9 w-16 items-center rounded-full border-2 border-ink bg-bg-base p-[3px] shadow-ink-sm ' +
        className
      }
    >
      <motion.span
        layout
        transition={easing.springToggle}
        className={
          'flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink text-sm ' +
          (isDark ? 'bg-info text-on-info' : 'bg-now text-on-now')
        }
        style={{ marginLeft: isDark ? 'auto' : 0 }}
      >
        {isDark ? '☾' : '☀'}
      </motion.span>
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/ThemeToggle.tsx
git commit -m "feat(client/ui): add ThemeToggle component"
```

---

### Task 10: Create the Button primitive

**Files:**
- Create: `packages/client/src/ui/Button.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Button.tsx`**

```tsx
import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'action' | 'info' | 'streak' | 'premium' | 'danger' | 'now' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  action:  'bg-action text-on-action',
  info:    'bg-info text-on-info',
  streak:  'bg-streak text-on-streak',
  premium: 'bg-premium text-on-premium',
  danger:  'bg-danger text-on-danger',
  now:     'bg-now text-on-now',
  ghost:   'bg-transparent text-ink',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg shadow-ink-sm',
  md: 'px-5 py-2.5 text-base rounded-xl shadow-ink',
  lg: 'px-6 py-3.5 text-lg rounded-2xl shadow-ink-lg',
};

export function Button({
  variant = 'action',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={!disabled && !loading ? { x: -1, y: -1 } : undefined}
      whileTap={!disabled && !loading ? { x: 4, y: 4 } : undefined}
      transition={{ duration: 0.08, ease: [0, 0, 0.2, 1] }}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 border-2 border-ink font-extrabold tracking-wide',
        'focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-[3px]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(' ')}
      {...(rest as any)}
    >
      {children}
      {loading && <span aria-hidden="true" className="ml-1 animate-pulse tracking-[0.15em]">● ● ●</span>}
    </motion.button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Button.tsx
git commit -m "feat(client/ui): add Button (7 variants × 3 sizes × loading state)"
```

---

### Task 11: Create the Input primitive

**Files:**
- Create: `packages/client/src/ui/Input.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Input.tsx`**

```tsx
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const hasError = Boolean(error);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hasError || undefined}
        aria-describedby={(helper || error) ? `${inputId}-msg` : undefined}
        className={[
          'w-full rounded-xl border-2 bg-bg-surface px-4 py-2.5 font-semibold text-ink',
          'placeholder:font-medium placeholder:text-ink-muted/60',
          'focus:outline-none',
          hasError
            ? 'border-danger shadow-[3px_3px_0_var(--danger)] focus:shadow-[3px_3px_0_var(--danger)]'
            : 'border-ink shadow-ink focus:border-info focus:shadow-[3px_3px_0_var(--info)]',
          className,
        ].join(' ')}
        {...rest}
      />
      {(helper || error) && (
        <span
          id={`${inputId}-msg`}
          className={hasError ? 'text-xs font-bold text-danger' : 'text-xs text-ink-muted'}
        >
          {error ?? helper}
        </span>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Input.tsx
git commit -m "feat(client/ui): add Input with label / helper / error states"
```

---

### Task 12: Create the Card primitive

**Files:**
- Create: `packages/client/src/ui/Card.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Card.tsx`**

```tsx
import type { ReactNode } from 'react';

interface CardProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({ eyebrow, title, children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-3xl border-2 border-ink bg-bg-surface p-6 shadow-ink-lg',
        className,
      ].join(' ')}
    >
      {eyebrow && (
        <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-streak">
          {eyebrow}
        </div>
      )}
      {title && (
        <div className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Card.tsx
git commit -m "feat(client/ui): add Card with optional eyebrow + title"
```

---

### Task 13: Create the Chip and Pill primitives

**Files:**
- Create: `packages/client/src/ui/Chip.tsx`
- Create: `packages/client/src/ui/Pill.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Chip.tsx`**

```tsx
import type { ReactNode } from 'react';

export type ChipVariant = 'default' | 'now' | 'info' | 'streak' | 'muted';

const STYLES: Record<ChipVariant, string> = {
  default: 'bg-bg-surface text-ink',
  now:     'bg-now text-on-now',
  info:    'bg-info text-on-info',
  streak:  'bg-streak text-on-streak',
  muted:   'bg-bg-sunken text-ink',
};

export function Chip({
  variant = 'default',
  children,
  className = '',
}: {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-extrabold shadow-ink-sm',
        STYLES[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create `packages/client/src/ui/Pill.tsx`**

```tsx
import type { ReactNode } from 'react';

export function Pill({
  status,
  children,
  className = '',
}: {
  status?: 'connected' | 'connecting' | 'offline';
  children: ReactNode;
  className?: string;
}) {
  const dotColor =
    status === 'connected'  ? 'bg-action' :
    status === 'offline'    ? 'bg-danger' :
                              'bg-warn';
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full border-2 border-ink bg-bg-surface px-3 py-1.5 text-sm font-bold text-ink shadow-ink-sm',
        className,
      ].join(' ')}
    >
      {status && <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/ui/Chip.tsx packages/client/src/ui/Pill.tsx
git commit -m "feat(client/ui): add Chip (5 variants) and status Pill"
```

---

### Task 14: Create the Tile primitive

**Files:**
- Create: `packages/client/src/ui/Tile.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Tile.tsx`**

```tsx
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export type TileState = 'idle' | 'correct' | 'partial' | 'wrong';

interface TileProps {
  state?: TileState;
  flipping?: boolean;
  flipDelaySec?: number;
  children?: ReactNode;
  className?: string;
}

const STATE_CLS: Record<TileState, string> = {
  idle:    'bg-bg-surface text-ink',
  correct: 'bg-action text-on-action',
  partial: 'bg-now text-on-now',
  wrong:   'bg-danger text-on-danger',
};

export function Tile({
  state = 'idle',
  flipping = false,
  flipDelaySec = 0,
  children,
  className = '',
}: TileProps) {
  return (
    <motion.div
      role="img"
      aria-label={`Tile ${state}`}
      initial={false}
      animate={flipping ? { rotateX: [0, 90, 0] } : { rotateX: 0 }}
      transition={
        flipping
          ? { duration: 0.25, times: [0, 0.5, 1], ease: 'easeInOut', delay: flipDelaySec }
          : { duration: 0.18 }
      }
      style={{ transformStyle: 'preserve-3d' }}
      className={[
        'inline-flex items-center justify-center rounded-lg border-2 border-ink shadow-ink-sm font-extrabold uppercase',
        STATE_CLS[state],
        className,
      ].join(' ')}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Tile.tsx
git commit -m "feat(client/ui): add Tile (4 states + flip animation)"
```

---

### Task 15: Create the Avatar primitive

**Files:**
- Create: `packages/client/src/ui/Avatar.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Avatar.tsx`**

```tsx
const PALETTE = ['#4a7adf', '#2ec27e', '#d96a3a', '#5b3a5b', '#ffd23f', '#e54848'] as const;

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 'md',
  className = '',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const bg = colorForKey(name);
  const sizeCls =
    size === 'sm' ? 'h-7 w-7 text-xs' :
    size === 'lg' ? 'h-12 w-12 text-base' :
                    'h-9 w-9 text-sm';
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full border-2 border-ink font-extrabold text-white shadow-ink-sm',
        sizeCls,
        className,
      ].join(' ')}
      style={{ background: bg, color: bg === '#ffd23f' ? '#181614' : '#ffffff' }}
      title={name}
      aria-label={name}
    >
      {initialsFor(name)}
    </span>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Avatar.tsx
git commit -m "feat(client/ui): add Avatar with deterministic color hashing"
```

---

### Task 16: Create the LeaderboardRow primitive

**Files:**
- Create: `packages/client/src/ui/LeaderboardRow.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/LeaderboardRow.tsx`**

```tsx
import { motion } from 'framer-motion';

interface LeaderboardRowProps {
  rank: number;
  name: string;
  score: number;
  delta?: number; // +N or -N points change since last update
  isYou?: boolean;
  className?: string;
}

function medalCls(rank: number): string {
  if (rank === 1) return 'bg-medal-gold text-ink';
  if (rank === 2) return 'bg-medal-silver text-ink';
  if (rank === 3) return 'bg-medal-bronze text-white';
  return 'bg-bg-surface text-ink';
}

export function LeaderboardRow({
  rank,
  name,
  score,
  delta,
  isYou = false,
  className = '',
}: LeaderboardRowProps) {
  return (
    <motion.div
      layout
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      className={[
        'grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 rounded-2xl border-2 border-ink px-4 py-2.5 shadow-ink font-extrabold',
        isYou ? 'bg-now text-on-now' : 'bg-bg-surface text-ink',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink shadow-ink-sm text-sm',
          medalCls(rank),
        ].join(' ')}
      >
        {rank}
      </span>
      <span className="text-base">{name}</span>
      <span className="font-display text-lg leading-none tracking-tight">{score}</span>
      {typeof delta === 'number' && delta !== 0 && (
        <span
          className={[
            'rounded-md border-2 border-ink px-2 py-0.5 text-xs font-extrabold',
            delta > 0 ? 'bg-action text-on-action' : 'bg-danger text-on-danger',
          ].join(' ')}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/LeaderboardRow.tsx
git commit -m "feat(client/ui): add LeaderboardRow with medal + delta + FLIP reorder"
```

---

### Task 17: Create the Countdown primitive

**Files:**
- Create: `packages/client/src/ui/Countdown.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/Countdown.tsx`**

```tsx
import { motion } from 'framer-motion';

interface CountdownProps {
  seconds: number;       // current value to display (e.g. 3, 2, 1)
  total: number;         // the starting value, used to compute ring fill
  size?: number;         // diameter in px
  className?: string;
}

export function Countdown({ seconds, total, size = 130, className = '' }: CountdownProps) {
  const radius = (size / 2) - 6;
  const circumference = 2 * Math.PI * radius;
  const elapsed = Math.max(0, total - seconds);
  const dashOffset = circumference - (elapsed / total) * circumference;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--ink)" strokeWidth={4} opacity={0.15}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--streak)" strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 200ms linear' }}
        />
      </svg>
      <motion.div
        key={seconds}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="absolute inset-0 flex items-center justify-center font-display text-5xl font-black leading-none tracking-tighter text-ink"
      >
        {seconds > 0 ? seconds : 'GO'}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/Countdown.tsx
git commit -m "feat(client/ui): add Countdown with ring fill + beat animation"
```

---

### Task 18: Create the ScoreDrop primitive (Pointless drop-bar)

**Files:**
- Create: `packages/client/src/ui/ScoreDrop.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/ScoreDrop.tsx`**

This is the §3.9 component — 4000ms base + 90ms per point, ease-out cubic, with the "POINTLESS" callout at 0.

```tsx
import { useEffect, useRef, useState } from 'react';
import { pointlessDrop, pointlessDropDurationMs } from '../lib/motion';

interface ScoreDropProps {
  /** The final score the bar should land on (0–100). */
  targetScore: number;
  /** If true, the drop animation runs once on mount. */
  autoStart?: boolean;
  /** Called when the drop finishes (after landing pause). */
  onLanded?: () => void;
  className?: string;
}

export function ScoreDrop({
  targetScore,
  autoStart = true,
  onLanded,
  className = '',
}: ScoreDropProps) {
  const [displayScore, setDisplayScore] = useState(100);
  const [dropPct, setDropPct] = useState(0);
  const [showPointless, setShowPointless] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoStart) return;
    setDisplayScore(100);
    setDropPct(0);
    setShowPointless(false);

    const startTime = performance.now();
    const fullDrop = 100 - targetScore;
    const duration = pointlessDropDurationMs(fullDrop);

    const frame = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const currentDrop = fullDrop * eased;
      setDropPct(currentDrop);
      setDisplayScore(Math.round(100 - currentDrop));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        if (targetScore === 0) setShowPointless(true);
        const pauseMs = targetScore === 0 ? pointlessDrop.landingPauseAtZeroMs : pointlessDrop.landingPauseMs;
        setTimeout(() => onLanded?.(), pauseMs);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoStart, targetScore, onLanded]);

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className="relative overflow-hidden rounded-2xl border-2 border-ink shadow-ink-lg"
        style={{
          width: 96, height: 240,
          background: 'linear-gradient(180deg, #e54848 0%, #d96a3a 20%, #ffd23f 50%, #6ec27e 80%, #2ec27e 100%)',
        }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayScore}
        aria-label="Pointless score"
      >
        <div
          className="absolute inset-x-0 top-0 flex items-end justify-center pb-1.5"
          style={{
            height: `${dropPct}%`,
            background: 'var(--ink)',
            borderBottom: '4px solid var(--now)',
          }}
        >
          <span className="font-display text-3xl font-black leading-none text-white">
            {displayScore}
          </span>
        </div>
        {showPointless && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md border-2 border-ink bg-ink px-2.5 py-1 font-serif text-sm font-extrabold text-action shadow-ink-sm">
            POINTLESS
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-[0.16em] text-ink-muted">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/client
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/ui/ScoreDrop.tsx
git commit -m "feat(client/ui): add ScoreDrop (Pointless drop-bar, 4s base + 90ms/pt)"
```

---

### Task 19: Build the UiShowcase page and barrel export

**Files:**
- Create: `packages/client/src/ui/UiShowcase.tsx`
- Create: `packages/client/src/ui/index.ts`
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Create `packages/client/src/ui/index.ts`**

```ts
export { Button } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';
export { Input } from './Input';
export { Card } from './Card';
export { Chip } from './Chip';
export type { ChipVariant } from './Chip';
export { Pill } from './Pill';
export { Tile } from './Tile';
export type { TileState } from './Tile';
export { Avatar } from './Avatar';
export { LeaderboardRow } from './LeaderboardRow';
export { Countdown } from './Countdown';
export { ScoreDrop } from './ScoreDrop';
export { ThemeToggle } from './ThemeToggle';
export { UiShowcase } from './UiShowcase';
```

- [ ] **Step 2: Create `packages/client/src/ui/UiShowcase.tsx`**

```tsx
import { useState } from 'react';
import {
  Button, Input, Card, Chip, Pill, Tile, Avatar,
  LeaderboardRow, Countdown, ScoreDrop, ThemeToggle,
} from './index';

export function UiShowcase() {
  const [dropKey, setDropKey] = useState(0);

  return (
    <div className="min-h-screen bg-bg-base px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">

        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-ink-muted">UI Showcase</div>
            <h1 className="font-display text-4xl font-black tracking-tight">PHoG primitives</h1>
            <p className="mt-1 text-sm text-ink-muted">Visual smoke-check for every primitive. Toggle the theme top-right.</p>
          </div>
          <ThemeToggle />
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="action">Let's go</Button>
            <Button variant="info">Round 3</Button>
            <Button variant="streak">3× Streak</Button>
            <Button variant="premium">Final</Button>
            <Button variant="danger">Pass</Button>
            <Button variant="now">Your turn</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="action" disabled>Disabled</Button>
            <Button variant="action" loading>Submitting</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="action" size="sm">Submit</Button>
            <Button variant="action" size="md">Submit</Button>
            <Button variant="action" size="lg">Submit</Button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Your name" placeholder="e.g. Peter" helper="2–20 characters." />
            <Input label="Your name" defaultValue="Peter" helper="Focused on click." />
            <Input label="Your name" defaultValue="" error="Name is required." />
          </div>
        </Section>

        <Section title="Card + Chip + Pill">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card eyebrow="Round 3 of 5" title="Pointless: Capital cities">
              <div className="flex flex-wrap gap-2">
                <Chip>Default</Chip>
                <Chip variant="now">Your turn</Chip>
                <Chip variant="info">12 players</Chip>
                <Chip variant="streak">3× streak</Chip>
                <Chip variant="muted">Quiet</Chip>
              </div>
            </Card>
            <div className="flex flex-col gap-3">
              <Pill status="connected">Connected to game server</Pill>
              <Pill status="connecting">Connecting…</Pill>
              <Pill status="offline">Offline</Pill>
            </div>
          </div>
        </Section>

        <Section title="Tile">
          <div className="flex gap-2">
            <Tile state="idle">P</Tile>
            <Tile state="correct">L</Tile>
            <Tile state="partial">A</Tile>
            <Tile state="wrong">Y</Tile>
            <Tile state="correct">S</Tile>
          </div>
        </Section>

        <Section title="Avatar">
          <div className="flex flex-wrap gap-2">
            <Avatar name="Ana" />
            <Avatar name="Ben Wright" />
            <Avatar name="Cara" />
            <Avatar name="Dan" />
            <Avatar name="Eli" />
            <Avatar name="Peter Jandro" size="lg" />
          </div>
        </Section>

        <Section title="Leaderboard rows">
          <div className="flex flex-col gap-2">
            <LeaderboardRow rank={1} name="Ana" score={340} delta={80} />
            <LeaderboardRow rank={2} name="You · Peter" score={280} delta={40} isYou />
            <LeaderboardRow rank={3} name="Cara" score={220} delta={-20} />
            <LeaderboardRow rank={4} name="Ben" score={200} />
          </div>
        </Section>

        <Section title="Countdown">
          <Countdown seconds={3} total={3} />
        </Section>

        <Section title="ScoreDrop (Pointless)">
          <div className="flex items-start gap-6">
            <ScoreDrop key={dropKey} targetScore={8} />
            <Button variant="info" size="sm" onClick={() => setDropKey(k => k + 1)}>
              Replay drop
            </Button>
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink/10 pt-6">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Modify `packages/client/src/App.tsx` to render the showcase when `?showcase` is in the URL**

Add this near the top of the `App` component's return (the first thing it does on render). Add the import for `UiShowcase`:

```tsx
import { UiShowcase } from './ui';
```

And at the very start of the component body:

```tsx
if (typeof window !== 'undefined' && window.location.search.includes('showcase')) {
  return <UiShowcase />;
}
```

This is a minimal, non-breaking branch — when the URL lacks `?showcase`, App renders exactly as before.

- [ ] **Step 4: Visually verify the showcase in both themes**

```bash
cd packages/client
npm run dev
```

Open http://localhost:5173/?showcase

Verify:
1. Every section renders without errors.
2. Click the theme toggle (top-right). The whole page switches palette smoothly (180ms color transition, no transform jank).
3. Refresh the page — your theme choice persists.
4. Open DevTools → Application → Local Storage. Confirm `phog-theme` is set to `"light"` or `"dark"`.
5. Clear `phog-theme` and change OS theme to dark. Reload the page. The showcase should render dark.
6. Click "Replay drop" under ScoreDrop — the bar should drop to 8 over ~12.3 seconds, accelerating then easing.

If anything looks wrong, fix it in the relevant primitive file, re-run the tests with `npm run test:run`, and re-verify.

- [ ] **Step 5: Stop the dev server and commit**

```bash
git add packages/client/src/ui/index.ts packages/client/src/ui/UiShowcase.tsx packages/client/src/App.tsx
git commit -m "feat(client/ui): add UiShowcase + barrel export + ?showcase route"
```

---

### Task 20: Mirror the foundation + primitives into the host package

The host package needs the same `ui/` + `lib/` tree so its screens can consume the same primitives in Phases 3+ of the migration.

**Files (all created or modified under `packages/host/`):**
- Modify: `index.html`
- Modify: `tailwind.config.js`
- Modify: `src/index.css`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/ui/tokens.css`
- Create: `src/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `Chip.tsx`, `Pill.tsx`, `Tile.tsx`, `Avatar.tsx`, `LeaderboardRow.tsx`, `Countdown.tsx`, `ScoreDrop.tsx`, `ThemeToggle.tsx`, `UiShowcase.tsx`, `index.ts`
- Create: `src/lib/theme.tsx`
- Create: `src/lib/motion.ts`

Note: the host package does **not** get Vitest in this plan. The ThemeProvider tests already validate the logic in the client; the host file is a verbatim copy of the same logic.

- [ ] **Step 1: Copy the `src/ui/` directory verbatim from client to host**

From the repo root:
```bash
mkdir -p packages/host/src/ui packages/host/src/lib
cp packages/client/src/ui/tokens.css packages/host/src/ui/
cp packages/client/src/ui/Button.tsx packages/host/src/ui/
cp packages/client/src/ui/Input.tsx packages/host/src/ui/
cp packages/client/src/ui/Card.tsx packages/host/src/ui/
cp packages/client/src/ui/Chip.tsx packages/host/src/ui/
cp packages/client/src/ui/Pill.tsx packages/host/src/ui/
cp packages/client/src/ui/Tile.tsx packages/host/src/ui/
cp packages/client/src/ui/Avatar.tsx packages/host/src/ui/
cp packages/client/src/ui/LeaderboardRow.tsx packages/host/src/ui/
cp packages/client/src/ui/Countdown.tsx packages/host/src/ui/
cp packages/client/src/ui/ScoreDrop.tsx packages/host/src/ui/
cp packages/client/src/ui/ThemeToggle.tsx packages/host/src/ui/
cp packages/client/src/ui/UiShowcase.tsx packages/host/src/ui/
cp packages/client/src/ui/index.ts packages/host/src/ui/
cp packages/client/src/lib/theme.tsx packages/host/src/lib/
cp packages/client/src/lib/motion.ts packages/host/src/lib/
```

Imports use relative paths (`../lib/theme`, `../lib/motion`) so no path edits are needed.

- [ ] **Step 2: Replace `packages/host/tailwind.config.js` with the same content as `packages/client/tailwind.config.js`**

```bash
cp packages/client/tailwind.config.js packages/host/tailwind.config.js
```

- [ ] **Step 3: Add Google Fonts + token import to `packages/host/src/index.css`**

Read the existing `packages/host/src/index.css`. Add the two `@import` lines at the very top (above any existing content):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Inter+Tight:wght@700;800;900&family=Fraunces:opsz,wght,SOFT@9..144,700;9..144,800,100&display=swap');
@import './ui/tokens.css';
```

Leave the rest of the file unchanged.

- [ ] **Step 4: Add the anti-flash inline script to `packages/host/index.html`**

Insert the same `<script>` block at the end of `<head>` in `packages/host/index.html`:

```html
<script>
  (function () {
    var saved = null;
    try { saved = localStorage.getItem('phog-theme'); } catch (_) {}
    var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

- [ ] **Step 5: Wrap the host app with `<ThemeProvider>` in `packages/host/src/main.tsx`**

Add the import:

```tsx
import { ThemeProvider } from './lib/theme';
```

Wrap the root render's `<App />` (or the existing top component) with `<ThemeProvider>…</ThemeProvider>`. Preserve any existing `<StrictMode>`.

- [ ] **Step 6: Add the `?showcase` branch to `packages/host/src/App.tsx`**

Add the import:

```tsx
import { UiShowcase } from './ui';
```

At the very top of the component's return logic:

```tsx
if (typeof window !== 'undefined' && window.location.search.includes('showcase')) {
  return <UiShowcase />;
}
```

- [ ] **Step 7: Verify the host build and showcase**

```bash
cd packages/host
npm run build
npm run dev
```

Open http://localhost:5174/?showcase. Verify the same checks as Task 19 step 4 (toggle theme, persistence, OS-pref following, ScoreDrop replay).

- [ ] **Step 8: Stop the dev server and commit**

```bash
git add packages/host/index.html packages/host/tailwind.config.js packages/host/src/index.css packages/host/src/main.tsx packages/host/src/App.tsx packages/host/src/ui/ packages/host/src/lib/
git commit -m "feat(host): mirror UI redesign foundation + primitives from client"
```

---

### Task 21: End-to-end verification

- [ ] **Step 1: Run the full client test suite**

```bash
cd packages/client
npm run test:run
```
Expected: 6 ThemeProvider tests pass; no other tests; exit 0.

- [ ] **Step 2: Build both apps**

```bash
cd packages/client && npm run build
cd ../host && npm run build
```
Expected: both builds succeed without TypeScript errors and without warnings about unresolved Tailwind classes.

- [ ] **Step 3: Smoke-test the existing games still work**

Start the server, client, and host in three terminals (per `QUICKSTART.md`):

```bash
# Terminal 1
cd packages/server && npm run dev
# Terminal 2
cd packages/client && npm run dev
# Terminal 3
cd packages/host && npm run dev
```

In a browser:
1. Open the host at http://localhost:5174, log in with the dev password.
2. Open the client at http://localhost:5173 in two tabs and join the lobby with two different names.
3. Start any single game (Quiz is the quickest) and play through one round.

Expected: every existing screen looks **exactly the same as before this plan** — no visual regression. The new primitives are dormant; the games keep using the legacy `index.css` rules.

- [ ] **Step 4: Visual showcase QA in both themes**

In a browser:
1. Open http://localhost:5173/?showcase — verify every section renders cleanly.
2. Toggle the theme — confirm a smooth 180ms color flip with no transform jank, no flash.
3. Reload — theme persists.
4. Clear `localStorage.phog-theme`, toggle OS theme to dark, reload — page renders dark without flash.
5. Repeat at http://localhost:5174/?showcase for the host.

- [ ] **Step 5: Stop all dev servers and commit if needed**

No new files in this verification task; just confirm `git status` shows a clean working tree.

```bash
git status
```
Expected: "nothing to commit, working tree clean."

---

## Done criteria

All of the following must be true before the plan is considered complete:

- [ ] `npm run build` succeeds in both `packages/client` and `packages/host`
- [ ] `npm run test:run` in `packages/client` shows 6 passing tests for ThemeProvider
- [ ] `/?showcase` renders cleanly on both apps in both light and dark
- [ ] Theme toggle persists in localStorage and survives reload
- [ ] OS-theme changes are followed live while `phog-theme` is unset; ignored once the user has toggled
- [ ] No existing game has visually regressed (Lobby, Quiz, Wordle, etc. look identical)
- [ ] No `index.css` rules or legacy Tailwind tokens have been removed (those are scheduled for the final-cleanup PR after all screen migrations)

---

## What this plan does NOT do (next plans)

The remaining 9 phases from spec §7.4 each get their own follow-up plan:

1. **Phase 3** — Migrate Lobby (player) + Dashboard (host) — first user-visible redesign
2. **Phase 4** — Migrate Countdown + FinalLeaderboard + Round/Placement leaderboards
3. **Phase 5** — Migrate Quiz + TrueFalse
4. **Phase 6** — Migrate Pointless (consuming `ScoreDrop`)
5. **Phase 7** — Migrate Wordle + WordleDisplay
6. **Phase 8** — Migrate ThemedDle (all 5 modes) + ThemedDleDisplay
7. **Phase 9** — Migrate Numbers + NumbersDisplay
8. **Phase 10** — Migrate Travel + TravelDisplay
9. **Phase 11** — Final-cleanup pass — remove deprecated `index.css` rules and old Tailwind tokens; WCAG AA contrast audit; `prefers-reduced-motion` substitutions; mobile QA
