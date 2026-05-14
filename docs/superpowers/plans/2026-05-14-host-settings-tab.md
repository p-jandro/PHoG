# Host Settings Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings tab to the host control app that supports full CRUD + enable/disable toggles on Quiz rounds, True/False statements, and Pointless rounds, with atomic file persistence.

**Architecture:** Introduce a server-side `contentStore` module that owns the three JSON files and exposes read-filtered (`getX()`) and read-all (`getXAll()`) APIs, plus `saveX()` with validation and atomic writes. Game modules switch from direct JSON imports to `contentStore` lookups. Host socket gains `host:settings:*` events gated on host auth + lobby phase. A new `Settings.tsx` screen on the host renders three editor sub-tabs (Quiz/T-F/Pointless).

**Tech Stack:** Node ESM, socket.io, React + TypeScript + Vite + Tailwind, `node --test` for server tests, Vitest for client tests.

---

## File Structure

**Server (`packages/server/src/`)**
- Create `contentStore.js` — module owning the 3 editable JSON files. Single source of truth.
- Modify `games/quiz.js` — replace direct `quizRounds` import with `contentStore.getQuizRounds()` calls.
- Modify `games/trueFalse.js` — replace `allStatements` import with `contentStore.getStatements()`.
- Modify `games/pointless.js` — replace `pointlessData` import with `contentStore.getPointlessRounds()`.
- Modify `index.js` — wire `host:settings:get` and `host:settings:save` socket handlers.

**Host (`packages/host/src/`)**
- Create `screens/Settings.tsx` — top-level Settings screen with 3 sub-tabs.
- Create `components/settings/QuizEditor.tsx`.
- Create `components/settings/TrueFalseEditor.tsx`.
- Create `components/settings/PointlessEditor.tsx`.
- Modify `screens/Dashboard.tsx` — add a "Settings" button in the header (lobby-only) that flips a local state to show the Settings screen instead.

**Tests (`tests/content-store/`)** — new directory.
- `validation.test.mjs` — per-kind validation.
- `enabled-filter.test.mjs` — getX() excludes disabled; getXAll() includes all.
- `atomic-write.test.mjs` — save creates .bak, in-memory cache updates.

**Client tests (`packages/host/src/components/settings/`)**
- `QuizEditor.test.tsx`, `TrueFalseEditor.test.tsx`, `PointlessEditor.test.tsx` — smoke tests.

---

## Task 1: contentStore module — read APIs

**Files:**
- Create: `packages/server/src/contentStore.js`
- Test: `tests/content-store/enabled-filter.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/content-store/enabled-filter.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'cs-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe('contentStore enabled filter', () => {
  it('getQuizRounds excludes enabled=false; getQuizRoundsAll includes all', () => {
    withTempDir((dir) => {
      const file = join(dir, 'quiz.json');
      writeFileSync(file, JSON.stringify([
        { roundNumber: 1, enabled: true,  options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
        { roundNumber: 2, enabled: false, options: [{ id: 'e' }, { id: 'f' }, { id: 'g' }, { id: 'h' }] },
        { roundNumber: 3,                  options: [{ id: 'i' }, { id: 'j' }, { id: 'k' }, { id: 'l' }] }
      ]));
      const cs = createContentStore({ quizPath: file, statementsPath: null, pointlessPath: null });
      assert.equal(cs.getQuizRounds().length, 2, 'enabled and missing-enabled count');
      assert.equal(cs.getQuizRoundsAll().length, 3, 'all included');
    });
  });

  it('getStatements excludes enabled=false', () => {
    withTempDir((dir) => {
      const file = join(dir, 'tf.json');
      writeFileSync(file, JSON.stringify([
        { id: 't1', statement: 'A', answer: true, enabled: true },
        { id: 't2', statement: 'B', answer: false, enabled: false }
      ]));
      const cs = createContentStore({ quizPath: null, statementsPath: file, pointlessPath: null });
      assert.equal(cs.getStatements().length, 1);
      assert.equal(cs.getStatementsAll().length, 2);
    });
  });

  it('getPointlessRounds excludes enabled=false', () => {
    withTempDir((dir) => {
      const file = join(dir, 'p.json');
      writeFileSync(file, JSON.stringify([
        { id: 'r1', category: 'A', question: 'Q', answers: { a: 100, b: 50, c: 25, d: 0 }, enabled: true },
        { id: 'r2', category: 'B', question: 'Q', answers: { e: 100, f: 50, g: 25, h: 0 }, enabled: false }
      ]));
      const cs = createContentStore({ quizPath: null, statementsPath: null, pointlessPath: file });
      assert.equal(cs.getPointlessRounds().length, 1);
      assert.equal(cs.getPointlessRoundsAll().length, 2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
node --test tests/content-store/enabled-filter.test.mjs
```
Expected: FAIL — `createContentStore` not exported.

- [ ] **Step 3: Implement contentStore — read paths**

Create `packages/server/src/contentStore.js`:
```js
/**
 * Content store — single source of truth for editable game content.
 * Owns three JSON files: quizRounds.json, statements.json, pointless.json.
 * Provides filtered read (enabled-only) and unfiltered read (all entries).
 * Save APIs added in Task 2.
 */
import { readFileSync, writeFileSync, statSync, renameSync, copyFileSync, existsSync } from 'node:fs';

const filterEnabled = (arr) => arr.filter((e) => e.enabled !== false);

function safeLoad(path) {
  if (!path) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[contentStore] Failed to load ${path}:`, err.message);
    return [];
  }
}

export function createContentStore({ quizPath, statementsPath, pointlessPath }) {
  let quiz = safeLoad(quizPath);
  let statements = safeLoad(statementsPath);
  let pointless = safeLoad(pointlessPath);

  return {
    getQuizRounds:        () => filterEnabled(quiz),
    getQuizRoundsAll:     () => quiz,
    getStatements:        () => filterEnabled(statements),
    getStatementsAll:     () => statements,
    getPointlessRounds:   () => filterEnabled(pointless),
    getPointlessRoundsAll:() => pointless,
    // Save APIs added in Task 2
  };
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
node --test tests/content-store/enabled-filter.test.mjs
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/contentStore.js tests/content-store/enabled-filter.test.mjs
git commit -m "feat(contentStore): read APIs with enabled filter"
```

---

## Task 2: contentStore — save APIs with atomic writes + validation

**Files:**
- Modify: `packages/server/src/contentStore.js`
- Test: `tests/content-store/validation.test.mjs`, `tests/content-store/atomic-write.test.mjs`

- [ ] **Step 1: Write validation tests**

Create `tests/content-store/validation.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cs-'));
  const quizPath = join(dir, 'quiz.json');
  const statementsPath = join(dir, 'tf.json');
  const pointlessPath = join(dir, 'p.json');
  writeFileSync(quizPath, '[]');
  writeFileSync(statementsPath, '[]');
  writeFileSync(pointlessPath, '[]');
  const cs = createContentStore({ quizPath, statementsPath, pointlessPath });
  return { cs, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('contentStore validation', () => {
  it('saveQuizRounds: requires exactly 4 options per round', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [] }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /options/);
    } finally { cleanup(); }
  });

  it('saveQuizRounds: rejects bad difficulty', () => {
    const { cs, cleanup } = setup();
    const goodOpt = (id) => ({
      id, category: 'C', difficulty: 'easy', color: '#ffffff',
      question: 'Q?', answers: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct: 'A'
    });
    try {
      const bad = { ...goodOpt('x'), difficulty: 'trivial' };
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [bad, goodOpt('a'), goodOpt('b'), goodOpt('c')] }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /difficulty/);
    } finally { cleanup(); }
  });

  it('saveStatements: rejects non-boolean answer', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.saveStatements([{ id: 's1', statement: 'X', answer: 'true', enabled: true }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /answer/);
    } finally { cleanup(); }
  });

  it('savePointlessRounds: requires >= 4 answers', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.savePointlessRounds([{ id: 'p1', category: 'C', question: 'Q', answers: { a: 100 }, enabled: true }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /at least 4 answers/i);
    } finally { cleanup(); }
  });

  it('savePointlessRounds: rejects score outside 0-100', () => {
    const { cs, cleanup } = setup();
    try {
      const r = cs.savePointlessRounds([{
        id: 'p1', category: 'C', question: 'Q',
        answers: { a: 100, b: 50, c: 25, d: 150 }, enabled: true
      }]);
      assert.equal(r.ok, false);
      assert.match(r.reason, /0-100/);
    } finally { cleanup(); }
  });

  it('saveQuizRounds: happy path returns ok and a version', () => {
    const { cs, cleanup } = setup();
    const opt = (id) => ({
      id, category: 'C', difficulty: 'easy', color: '#ffffff',
      question: 'Q?', answers: { A: 'a', B: 'b', C: 'c', D: 'd' }, correct: 'A'
    });
    try {
      const r = cs.saveQuizRounds([{ roundNumber: 1, enabled: true, options: [opt('a'), opt('b'), opt('c'), opt('d')] }]);
      assert.equal(r.ok, true);
      assert.equal(typeof r.version, 'number');
    } finally { cleanup(); }
  });
});
```

- [ ] **Step 2: Write atomic-write test**

Create `tests/content-store/atomic-write.test.mjs`:
```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentStore } from '../../packages/server/src/contentStore.js';

describe('contentStore atomic write', () => {
  it('save creates .bak of previous content and writes new content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    try {
      const tfPath = join(dir, 'tf.json');
      const initial = [{ id: 'old', statement: 'Old', answer: true, enabled: true }];
      writeFileSync(tfPath, JSON.stringify(initial));
      const cs = createContentStore({ quizPath: null, statementsPath: tfPath, pointlessPath: null });
      const next = [{ id: 'new', statement: 'New', answer: false, enabled: true, explanation: '' }];
      const r = cs.saveStatements(next);
      assert.equal(r.ok, true);
      const written = JSON.parse(readFileSync(tfPath, 'utf-8'));
      assert.deepEqual(written, next);
      assert.ok(existsSync(tfPath + '.bak'), '.bak file should exist');
      const bak = JSON.parse(readFileSync(tfPath + '.bak', 'utf-8'));
      assert.deepEqual(bak, initial, '.bak should hold previous content');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('in-memory cache reflects saved data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-'));
    try {
      const tfPath = join(dir, 'tf.json');
      writeFileSync(tfPath, '[]');
      const cs = createContentStore({ quizPath: null, statementsPath: tfPath, pointlessPath: null });
      assert.equal(cs.getStatementsAll().length, 0);
      cs.saveStatements([{ id: 's1', statement: 'X', answer: true, enabled: true, explanation: '' }]);
      assert.equal(cs.getStatementsAll().length, 1);
      assert.equal(cs.getStatements().length, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
node --test tests/content-store/validation.test.mjs tests/content-store/atomic-write.test.mjs
```
Expected: FAIL — save methods don't exist.

- [ ] **Step 4: Add validation + save to contentStore**

Replace the contents of `packages/server/src/contentStore.js`:
```js
import { readFileSync, writeFileSync, statSync, renameSync, copyFileSync, existsSync } from 'node:fs';

const filterEnabled = (arr) => arr.filter((e) => e.enabled !== false);

function safeLoad(path) {
  if (!path) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[contentStore] Failed to load ${path}:`, err.message);
    return [];
  }
}

// ---------- Validators ----------

function validateQuizRound(round, idx) {
  if (typeof round !== 'object' || round === null) return `rounds[${idx}]: must be an object`;
  if (!Number.isInteger(round.roundNumber) || round.roundNumber < 1) return `rounds[${idx}].roundNumber: must be integer >= 1`;
  if (typeof round.enabled !== 'boolean') return `rounds[${idx}].enabled: must be boolean`;
  if (!Array.isArray(round.options) || round.options.length !== 4) return `rounds[${idx}].options: must have exactly 4 options`;
  const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard', 'impossible']);
  for (let i = 0; i < 4; i++) {
    const o = round.options[i];
    const path = `rounds[${idx}].options[${i}]`;
    if (!o || typeof o !== 'object') return `${path}: must be an object`;
    if (typeof o.id !== 'string' || !o.id) return `${path}.id: required`;
    if (typeof o.category !== 'string' || !o.category) return `${path}.category: required`;
    if (!VALID_DIFFICULTY.has(o.difficulty)) return `${path}.difficulty: must be one of easy/medium/hard/impossible`;
    if (typeof o.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(o.color)) return `${path}.color: must be #rrggbb`;
    if (typeof o.question !== 'string' || !o.question) return `${path}.question: required`;
    if (!o.answers || ['A','B','C','D'].some((k) => typeof o.answers[k] !== 'string' || !o.answers[k])) return `${path}.answers: A/B/C/D all required, non-empty strings`;
    if (!['A','B','C','D'].includes(o.correct)) return `${path}.correct: must be A/B/C/D`;
  }
  return null;
}

function validateStatement(s, idx) {
  if (!s || typeof s !== 'object') return `statements[${idx}]: must be object`;
  if (typeof s.id !== 'string' || !s.id) return `statements[${idx}].id: required`;
  if (typeof s.statement !== 'string' || !s.statement) return `statements[${idx}].statement: required`;
  if (typeof s.answer !== 'boolean') return `statements[${idx}].answer: must be boolean`;
  if (s.explanation !== undefined && typeof s.explanation !== 'string') return `statements[${idx}].explanation: must be string`;
  if (typeof s.enabled !== 'boolean') return `statements[${idx}].enabled: must be boolean`;
  return null;
}

function validatePointlessRound(r, idx) {
  if (!r || typeof r !== 'object') return `rounds[${idx}]: must be object`;
  if (typeof r.id !== 'string' || !r.id) return `rounds[${idx}].id: required`;
  if (typeof r.category !== 'string' || !r.category) return `rounds[${idx}].category: required`;
  if (typeof r.question !== 'string' || !r.question) return `rounds[${idx}].question: required`;
  if (!r.answers || typeof r.answers !== 'object') return `rounds[${idx}].answers: required`;
  const keys = Object.keys(r.answers);
  if (keys.length < 4) return `rounds[${idx}].answers: at least 4 answers required`;
  const lower = new Set();
  for (const k of keys) {
    if (lower.has(k.toLowerCase())) return `rounds[${idx}].answers: duplicate key "${k}"`;
    lower.add(k.toLowerCase());
    const v = r.answers[k];
    if (!Number.isInteger(v) || v < 0 || v > 100) return `rounds[${idx}].answers["${k}"]: must be integer 0-100`;
  }
  if (typeof r.enabled !== 'boolean') return `rounds[${idx}].enabled: must be boolean`;
  return null;
}

// ---------- Atomic write ----------

function atomicWriteJSON(path, data) {
  if (existsSync(path)) copyFileSync(path, path + '.bak');
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
  return statSync(path).mtimeMs;
}

// ---------- Factory ----------

export function createContentStore({ quizPath, statementsPath, pointlessPath }) {
  let quiz = safeLoad(quizPath);
  let statements = safeLoad(statementsPath);
  let pointless = safeLoad(pointlessPath);

  const saveQuizRounds = (data) => {
    if (!Array.isArray(data)) return { ok: false, reason: 'must be an array' };
    for (let i = 0; i < data.length; i++) {
      const err = validateQuizRound(data[i], i);
      if (err) return { ok: false, reason: err };
    }
    if (!quizPath) return { ok: false, reason: 'no path configured' };
    try {
      const version = atomicWriteJSON(quizPath, data);
      quiz = data;
      return { ok: true, version };
    } catch (err) {
      return { ok: false, reason: `write_failed: ${err.message}` };
    }
  };

  const saveStatements = (data) => {
    if (!Array.isArray(data)) return { ok: false, reason: 'must be an array' };
    for (let i = 0; i < data.length; i++) {
      const err = validateStatement(data[i], i);
      if (err) return { ok: false, reason: err };
    }
    if (!statementsPath) return { ok: false, reason: 'no path configured' };
    try {
      const version = atomicWriteJSON(statementsPath, data);
      statements = data;
      return { ok: true, version };
    } catch (err) {
      return { ok: false, reason: `write_failed: ${err.message}` };
    }
  };

  const savePointlessRounds = (data) => {
    if (!Array.isArray(data)) return { ok: false, reason: 'must be an array' };
    for (let i = 0; i < data.length; i++) {
      const err = validatePointlessRound(data[i], i);
      if (err) return { ok: false, reason: err };
    }
    if (!pointlessPath) return { ok: false, reason: 'no path configured' };
    try {
      const version = atomicWriteJSON(pointlessPath, data);
      pointless = data;
      return { ok: true, version };
    } catch (err) {
      return { ok: false, reason: `write_failed: ${err.message}` };
    }
  };

  const getVersion = (kind) => {
    const path = kind === 'quiz' ? quizPath : kind === 'trueFalse' ? statementsPath : kind === 'pointless' ? pointlessPath : null;
    if (!path || !existsSync(path)) return 0;
    return statSync(path).mtimeMs;
  };

  return {
    getQuizRounds:        () => filterEnabled(quiz),
    getQuizRoundsAll:     () => quiz,
    getStatements:        () => filterEnabled(statements),
    getStatementsAll:     () => statements,
    getPointlessRounds:   () => filterEnabled(pointless),
    getPointlessRoundsAll:() => pointless,
    saveQuizRounds,
    saveStatements,
    savePointlessRounds,
    getVersion
  };
}
```

- [ ] **Step 5: Run tests to verify pass**

```bash
node --test tests/content-store/validation.test.mjs tests/content-store/atomic-write.test.mjs tests/content-store/enabled-filter.test.mjs
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/contentStore.js tests/content-store/
git commit -m "feat(contentStore): validation + atomic save with .bak"
```

---

## Task 3: Wire contentStore as default singleton; refactor game modules

**Files:**
- Modify: `packages/server/src/contentStore.js` — add default-singleton export bound to real data paths.
- Modify: `packages/server/src/games/quiz.js`
- Modify: `packages/server/src/games/trueFalse.js`
- Modify: `packages/server/src/games/pointless.js`

- [ ] **Step 1: Add default singleton to contentStore.js**

Append at the bottom of `packages/server/src/contentStore.js`:
```js
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const contentStore = createContentStore({
  quizPath:       join(__dirname, 'data', 'quizRounds.json'),
  statementsPath: join(__dirname, 'data', 'statements.json'),
  pointlessPath:  join(__dirname, 'data', 'pointless.json')
});
```

- [ ] **Step 2: Refactor quiz.js**

In `packages/server/src/games/quiz.js`:

Replace lines 7-18 (`import { readFileSync }` and the `quizRounds` read) with:
```js
import { contentStore } from '../contentStore.js';
```
Also remove unused imports (`fileURLToPath`, `dirname`, `join`).

Find and replace every read of `quizRounds`:
- Line 41 (`Math.min(10, quizRounds.length)`) → `Math.min(10, contentStore.getQuizRounds().length)`
- Line 98 (`const round = quizRounds[roundIndex]`) → `const round = contentStore.getQuizRounds()[roundIndex]`

- [ ] **Step 3: Refactor trueFalse.js**

Replace lines 6-16 (the `readFileSync` and `allStatements` block) with:
```js
import { contentStore } from '../contentStore.js';
```
Remove unused `fileURLToPath`/`dirname`/`join` imports.

Find every read of `allStatements`:
- Line 116 (`allStatements.filter(...)`) → `contentStore.getStatements().filter(...)`

- [ ] **Step 4: Refactor pointless.js**

Replace lines 1-12 (imports + `pointlessData` load) with:
```js
import stringSimilarity from 'string-similarity';
import { Timer } from '../utils/timer.js';
import { contentStore } from '../contentStore.js';
```

Replace every read of `pointlessData`:
- Line 127 (`pointlessData.length`) → `contentStore.getPointlessRounds().length`
- Line 149 (`index >= pointlessData.length`) → `index >= contentStore.getPointlessRounds().length`
- Line 154 (`pointlessData[index]`) → `contentStore.getPointlessRounds()[index]`
- Line 177 (`totalRounds: pointlessData.length`) → `totalRounds: contentStore.getPointlessRounds().length`
- Line 221, 453, 465, 524, 532 — each `pointlessData[...]` or `.length` → equivalent `contentStore.getPointlessRounds()[...]` / `.length`

- [ ] **Step 5: Run existing server tests to confirm no regressions**

```bash
node --test tests/numbers/difficulty-scoring.test.mjs tests/themed-dle/scoring.test.mjs tests/themed-dle/mode-weighting.test.mjs tests/travel/wrong-guess-counts.test.mjs tests/pointless/early-end.test.mjs tests/pointless/host-privacy.test.mjs tests/content-store/
```
Expected: all PASS.

- [ ] **Step 6: Smoke test server starts**

```bash
HOST_PASSWORD=admin timeout 5 node packages/server/src/index.js 2>&1 | head -20
```
Expected: prints `[ENV] Environment loaded` and `Server listening on port 3000` then is killed by the timeout. No `Cannot read` / `undefined` errors.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/contentStore.js packages/server/src/games/quiz.js packages/server/src/games/trueFalse.js packages/server/src/games/pointless.js
git commit -m "refactor(server): game modules read content via contentStore"
```

---

## Task 4: Socket handlers for host:settings:get / :save

**Files:**
- Modify: `packages/server/src/index.js` — add two socket handlers.

- [ ] **Step 1: Locate existing host:control handler**

```bash
grep -n "socket.on('host:control'" packages/server/src/index.js
```
Note the line. Insert the new handlers immediately above or below it.

- [ ] **Step 2: Add the handlers**

Just before `socket.on('host:control', …)` insert:
```js
function isAuthorizedHost(socket) {
  return socket.id === gameState.meta?.hostSocketId;
}

socket.on('host:settings:get', ({ kind } = {}) => {
  try {
    if (!isAuthorizedHost(socket)) {
      socket.emit('host:settings:rejected', { kind, reason: 'not_authorized' });
      return;
    }
    let data;
    if (kind === 'quiz')      data = contentStore.getQuizRoundsAll();
    else if (kind === 'trueFalse') data = contentStore.getStatementsAll();
    else if (kind === 'pointless') data = contentStore.getPointlessRoundsAll();
    else { socket.emit('host:settings:rejected', { kind, reason: 'unknown_kind' }); return; }
    const version = contentStore.getVersion(kind);
    socket.emit('host:settings:data', { kind, data, version });
  } catch (err) {
    console.error('[ERROR] host:settings:get:', err);
    socket.emit('host:settings:rejected', { kind, reason: 'server_error' });
  }
});

socket.on('host:settings:save', ({ kind, data, version } = {}) => {
  try {
    if (!isAuthorizedHost(socket)) {
      socket.emit('host:settings:rejected', { kind, reason: 'not_authorized' });
      return;
    }
    if (gameState.phase !== 'lobby') {
      socket.emit('host:settings:rejected', { kind, reason: 'wrong_phase' });
      return;
    }
    const currentVersion = contentStore.getVersion(kind);
    if (typeof version === 'number' && version > 0 && Math.abs(currentVersion - version) > 1) {
      socket.emit('host:settings:rejected', { kind, reason: 'stale_version', currentVersion });
      return;
    }
    let result;
    if (kind === 'quiz')      result = contentStore.saveQuizRounds(data);
    else if (kind === 'trueFalse') result = contentStore.saveStatements(data);
    else if (kind === 'pointless') result = contentStore.savePointlessRounds(data);
    else { socket.emit('host:settings:rejected', { kind, reason: 'unknown_kind' }); return; }
    if (result.ok) {
      socket.emit('host:settings:saved', { kind, version: result.version });
    } else {
      socket.emit('host:settings:rejected', { kind, reason: 'validation', details: result.reason });
    }
  } catch (err) {
    console.error('[ERROR] host:settings:save:', err);
    socket.emit('host:settings:rejected', { kind, reason: 'server_error' });
  }
});
```

Add the contentStore import near the top of index.js (in the imports area):
```js
import { contentStore } from './contentStore.js';
```

- [ ] **Step 3: Sanity check — server starts**

```bash
HOST_PASSWORD=admin timeout 5 node packages/server/src/index.js 2>&1 | head -10
```
Expected: clean start.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.js
git commit -m "feat(server): host:settings:get and host:settings:save socket events"
```

---

## Task 5: Settings screen scaffolding + nav from Dashboard

**Files:**
- Create: `packages/host/src/screens/Settings.tsx`
- Modify: `packages/host/src/screens/Dashboard.tsx` — Settings button + screen toggle.

- [ ] **Step 1: Create Settings.tsx (empty shell with 3 tabs)**

Create `packages/host/src/screens/Settings.tsx`:
```tsx
import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { Button, Chip } from '../ui';
import { HostScreenShell } from '../components/HostScreenShell';
import { QuizEditor } from '../components/settings/QuizEditor';
import { TrueFalseEditor } from '../components/settings/TrueFalseEditor';
import { PointlessEditor } from '../components/settings/PointlessEditor';

type Tab = 'quiz' | 'trueFalse' | 'pointless';

interface SettingsProps {
  socket: Socket | null;
  onClose: () => void;
}

export const Settings = ({ socket, onClose }: SettingsProps) => {
  const [tab, setTab] = useState<Tab>('quiz');

  return (
    <HostScreenShell location="Host · Settings" topRight={{ kind: 'theme-toggle' }}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['quiz', 'trueFalse', 'pointless'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'rounded-2xl border-2 border-ink px-4 py-2 text-sm font-extrabold uppercase tracking-[0.14em] shadow-ink-sm',
                  tab === t ? 'bg-streak text-on-streak' : 'bg-bg-surface text-ink'
                ].join(' ')}
              >
                {t === 'quiz' ? 'Quiz' : t === 'trueFalse' ? 'True/False' : 'Pointless'}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={onClose}>← Back to Dashboard</Button>
        </div>

        {tab === 'quiz' && <QuizEditor socket={socket} />}
        {tab === 'trueFalse' && <TrueFalseEditor socket={socket} />}
        {tab === 'pointless' && <PointlessEditor socket={socket} />}
      </div>
    </HostScreenShell>
  );
};
```

- [ ] **Step 2: Create editor stubs**

Create `packages/host/src/components/settings/QuizEditor.tsx`:
```tsx
import { Socket } from 'socket.io-client';

interface Props { socket: Socket | null; }

export const QuizEditor = ({ socket }: Props) => (
  <div className="rounded-2xl border-2 border-ink bg-bg-surface p-6 shadow-ink-sm">
    <p className="text-ink-muted">Quiz editor — coming in next task.</p>
  </div>
);
```

Same skeleton for `packages/host/src/components/settings/TrueFalseEditor.tsx` and `packages/host/src/components/settings/PointlessEditor.tsx` (change the placeholder text).

- [ ] **Step 3: Hook Settings into Dashboard**

In `packages/host/src/screens/Dashboard.tsx`, add at the top of the component (near other `useState` calls):
```ts
const [showSettings, setShowSettings] = useState(false);
```

Add a `Settings` import at the top of the file:
```ts
import { Settings } from './Settings';
```

Add a Settings button in the header area (near the logout / status pills, around line 360). Insert after the existing status chips:
```tsx
{gameState?.phase === 'lobby' && (
  <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
    Settings
  </Button>
)}
```

Wrap the main `return (…)` so Settings can take over the screen:
```tsx
if (showSettings) {
  return <Settings socket={socket} onClose={() => setShowSettings(false)} />;
}
return (
  <HostScreenShell …>
    {/* existing content unchanged */}
  </HostScreenShell>
);
```

- [ ] **Step 4: Type-check**

```bash
cd packages/host && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/screens/Settings.tsx packages/host/src/components/settings/ packages/host/src/screens/Dashboard.tsx
git commit -m "feat(host): Settings screen scaffold with 3 tabs"
```

---

## Task 6: TrueFalseEditor (simplest data shape — pilot the pattern)

**Files:**
- Modify: `packages/host/src/components/settings/TrueFalseEditor.tsx`
- Test: `packages/host/src/components/settings/TrueFalseEditor.test.tsx`

- [ ] **Step 1: Write a smoke test**

Create `packages/host/src/components/settings/TrueFalseEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrueFalseEditor } from './TrueFalseEditor';

function mockSocket() {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((ev: string, cb: Function) => { handlers[ev] = cb; }),
    off: vi.fn(),
    emit: vi.fn(),
    _fire: (ev: string, payload: any) => handlers[ev]?.(payload)
  } as any;
}

describe('TrueFalseEditor', () => {
  it('renders statements after host:settings:data arrives', () => {
    const s = mockSocket();
    render(<TrueFalseEditor socket={s} />);
    s._fire('host:settings:data', {
      kind: 'trueFalse',
      version: 1,
      data: [
        { id: 't1', statement: 'Water boils at 100°C', answer: true, enabled: true, explanation: '' }
      ]
    });
    expect(screen.getByDisplayValue('Water boils at 100°C')).toBeInTheDocument();
  });

  it('Save emits host:settings:save with the current data', () => {
    const s = mockSocket();
    render(<TrueFalseEditor socket={s} />);
    s._fire('host:settings:data', {
      kind: 'trueFalse',
      version: 5,
      data: [{ id: 't1', statement: 'X', answer: true, enabled: true, explanation: '' }]
    });
    fireEvent.click(screen.getByText('Save'));
    expect(s.emit).toHaveBeenCalledWith('host:settings:save', expect.objectContaining({
      kind: 'trueFalse',
      version: 5
    }));
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd packages/host && npx vitest run TrueFalseEditor
```
Expected: FAIL — current stub doesn't implement anything.

- [ ] **Step 3: Implement TrueFalseEditor**

Replace `packages/host/src/components/settings/TrueFalseEditor.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Button, Chip } from '../../ui';

interface Statement {
  id: string;
  statement: string;
  answer: boolean;
  explanation?: string;
  enabled: boolean;
}

interface Props { socket: Socket | null; }

export const TrueFalseEditor = ({ socket }: Props) => {
  const [items, setItems] = useState<Statement[] | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onData = (p: any) => {
      if (p?.kind !== 'trueFalse') return;
      setItems(p.data || []);
      setVersion(p.version || 0);
    };
    const onSaved = (p: any) => {
      if (p?.kind !== 'trueFalse') return;
      setVersion(p.version || 0);
      setStatus('Saved');
      setTimeout(() => setStatus(null), 1500);
    };
    const onRejected = (p: any) => {
      if (p?.kind !== 'trueFalse') return;
      setStatus(`Save failed: ${p.reason}${p.details ? ' — ' + p.details : ''}`);
    };
    socket.on('host:settings:data', onData);
    socket.on('host:settings:saved', onSaved);
    socket.on('host:settings:rejected', onRejected);
    socket.emit('host:settings:get', { kind: 'trueFalse' });
    return () => {
      socket.off('host:settings:data', onData);
      socket.off('host:settings:saved', onSaved);
      socket.off('host:settings:rejected', onRejected);
    };
  }, [socket]);

  const update = (idx: number, patch: Partial<Statement>) => {
    if (!items) return;
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    if (!items) return;
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const remove = (idx: number) => {
    if (!items) return;
    if (!confirm('Delete this statement? This cannot be undone.')) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const add = () => {
    if (!items) return;
    const id = 'tf' + Date.now().toString(36);
    setItems([...items, { id, statement: '', answer: true, explanation: '', enabled: true }]);
  };

  const save = () => {
    if (!socket || !items) return;
    socket.emit('host:settings:save', { kind: 'trueFalse', data: items, version });
  };

  const reload = () => {
    if (!socket) return;
    socket.emit('host:settings:get', { kind: 'trueFalse' });
  };

  if (!items) return <div className="rounded-2xl border-2 border-ink bg-bg-surface p-6 text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Chip variant="info">{items.length} statements</Chip>
        <div className="flex gap-2">
          {status && <Chip variant="muted">{status}</Chip>}
          <Button variant="ghost" size="sm" onClick={reload}>Reload</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={s.id} className="rounded-2xl border-2 border-ink bg-bg-surface p-3 shadow-ink-sm">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
                aria-label="Enabled"
              />
              <input
                type="text"
                value={s.statement}
                onChange={(e) => update(i, { statement: e.target.value })}
                className="flex-1 rounded border-2 border-ink bg-bg-base px-2 py-1 text-sm"
                placeholder="Statement…"
              />
              <select
                value={String(s.answer)}
                onChange={(e) => update(i, { answer: e.target.value === 'true' })}
                className="rounded border-2 border-ink bg-bg-base px-2 py-1 text-sm"
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, +1)} disabled={i === items.length - 1}>↓</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(i)}>✕</Button>
            </div>
            <input
              type="text"
              value={s.explanation || ''}
              onChange={(e) => update(i, { explanation: e.target.value })}
              className="mt-2 w-full rounded border-2 border-ink bg-bg-base px-2 py-1 text-xs text-ink-muted"
              placeholder="Explanation (optional)"
            />
          </li>
        ))}
      </ul>

      <Button onClick={add}>+ New statement</Button>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd packages/host && npx vitest run TrueFalseEditor
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/components/settings/TrueFalseEditor.tsx packages/host/src/components/settings/TrueFalseEditor.test.tsx
git commit -m "feat(host): TrueFalseEditor — CRUD + enable toggle + reorder"
```

---

## Task 7: PointlessEditor

**Files:**
- Modify: `packages/host/src/components/settings/PointlessEditor.tsx`
- Test: `packages/host/src/components/settings/PointlessEditor.test.tsx`

- [ ] **Step 1: Write smoke test**

Create `packages/host/src/components/settings/PointlessEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PointlessEditor } from './PointlessEditor';

function mockSocket() {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((ev: string, cb: Function) => { handlers[ev] = cb; }),
    off: vi.fn(),
    emit: vi.fn(),
    _fire: (ev: string, payload: any) => handlers[ev]?.(payload)
  } as any;
}

describe('PointlessEditor', () => {
  it('renders rounds and answer rows', () => {
    const s = mockSocket();
    render(<PointlessEditor socket={s} />);
    s._fire('host:settings:data', {
      kind: 'pointless', version: 1,
      data: [{
        id: 'r1', category: 'Cats', question: 'Name a cat breed',
        answers: { persian: 90, siamese: 60, maine: 30, sphinx: 10 },
        enabled: true
      }]
    });
    expect(screen.getByDisplayValue('Cats')).toBeInTheDocument();
    expect(screen.getByDisplayValue('persian')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
cd packages/host && npx vitest run PointlessEditor
```
Expected: FAIL.

- [ ] **Step 3: Implement PointlessEditor**

Replace `packages/host/src/components/settings/PointlessEditor.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Button, Chip } from '../../ui';

interface PointlessRound {
  id: string;
  category: string;
  question: string;
  answers: Record<string, number>;
  enabled: boolean;
}

interface Props { socket: Socket | null; }

export const PointlessEditor = ({ socket }: Props) => {
  const [items, setItems] = useState<PointlessRound[] | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onData = (p: any) => {
      if (p?.kind !== 'pointless') return;
      setItems(p.data || []);
      setVersion(p.version || 0);
    };
    const onSaved = (p: any) => {
      if (p?.kind !== 'pointless') return;
      setVersion(p.version || 0);
      setStatus('Saved');
      setTimeout(() => setStatus(null), 1500);
    };
    const onRejected = (p: any) => {
      if (p?.kind !== 'pointless') return;
      setStatus(`Save failed: ${p.reason}${p.details ? ' — ' + p.details : ''}`);
    };
    socket.on('host:settings:data', onData);
    socket.on('host:settings:saved', onSaved);
    socket.on('host:settings:rejected', onRejected);
    socket.emit('host:settings:get', { kind: 'pointless' });
    return () => {
      socket.off('host:settings:data', onData);
      socket.off('host:settings:saved', onSaved);
      socket.off('host:settings:rejected', onRejected);
    };
  }, [socket]);

  const updateRound = (idx: number, patch: Partial<PointlessRound>) => {
    if (!items) return;
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const updateAnswerKey = (idx: number, oldKey: string, newKey: string) => {
    if (!items) return;
    const r = items[idx];
    if (oldKey === newKey || !newKey || r.answers[newKey] !== undefined) return;
    const nextAnswers: Record<string, number> = {};
    for (const k of Object.keys(r.answers)) nextAnswers[k === oldKey ? newKey : k] = r.answers[k];
    updateRound(idx, { answers: nextAnswers });
  };

  const updateAnswerScore = (idx: number, key: string, score: number) => {
    if (!items) return;
    updateRound(idx, { answers: { ...items[idx].answers, [key]: score } });
  };

  const removeAnswer = (idx: number, key: string) => {
    if (!items) return;
    const next = { ...items[idx].answers };
    delete next[key];
    updateRound(idx, { answers: next });
  };

  const addAnswer = (idx: number) => {
    if (!items) return;
    const r = items[idx];
    let n = 1;
    while (r.answers['new_' + n] !== undefined) n++;
    updateRound(idx, { answers: { ...r.answers, ['new_' + n]: 50 } });
  };

  const moveRound = (idx: number, dir: -1 | 1) => {
    if (!items) return;
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  };

  const removeRound = (idx: number) => {
    if (!items) return;
    if (!confirm('Delete this round? This cannot be undone.')) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const addRound = () => {
    if (!items) return;
    setItems([...items, {
      id: 'p' + Date.now().toString(36),
      category: '', question: '',
      answers: { a: 100, b: 75, c: 50, d: 25 },
      enabled: true
    }]);
  };

  const save = () => {
    if (!socket || !items) return;
    socket.emit('host:settings:save', { kind: 'pointless', data: items, version });
  };

  const reload = () => {
    if (!socket) return;
    socket.emit('host:settings:get', { kind: 'pointless' });
  };

  if (!items) return <div className="rounded-2xl border-2 border-ink bg-bg-surface p-6 text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Chip variant="info">{items.length} rounds</Chip>
        <div className="flex gap-2">
          {status && <Chip variant="muted">{status}</Chip>}
          <Button variant="ghost" size="sm" onClick={reload}>Reload</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </div>

      <ul className="space-y-4">
        {items.map((r, i) => (
          <li key={r.id} className="rounded-2xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={r.enabled} onChange={(e) => updateRound(i, { enabled: e.target.checked })} aria-label="Enabled" />
              <input
                type="text"
                value={r.category}
                onChange={(e) => updateRound(i, { category: e.target.value })}
                className="flex-1 rounded border-2 border-ink bg-bg-base px-2 py-1 text-sm font-bold"
                placeholder="Category…"
              />
              <Button variant="ghost" size="sm" onClick={() => moveRound(i, -1)} disabled={i === 0}>↑</Button>
              <Button variant="ghost" size="sm" onClick={() => moveRound(i, +1)} disabled={i === items.length - 1}>↓</Button>
              <Button variant="ghost" size="sm" onClick={() => removeRound(i)}>✕</Button>
            </div>
            <input
              type="text"
              value={r.question}
              onChange={(e) => updateRound(i, { question: e.target.value })}
              className="mt-2 w-full rounded border-2 border-ink bg-bg-base px-2 py-1 text-sm"
              placeholder="Question prompt…"
            />
            <ul className="mt-2 space-y-1">
              {Object.entries(r.answers).map(([key, score]) => (
                <li key={key} className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={key}
                    onBlur={(e) => updateAnswerKey(i, key, e.target.value.trim())}
                    className="flex-1 rounded border border-ink bg-bg-base px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    value={score}
                    min={0}
                    max={100}
                    onChange={(e) => updateAnswerScore(i, key, Number.parseInt(e.target.value, 10) || 0)}
                    className="w-20 rounded border border-ink bg-bg-base px-2 py-1 text-xs"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeAnswer(i, key)}>✕</Button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={() => addAnswer(i)}>+ Answer</Button>
          </li>
        ))}
      </ul>

      <Button onClick={addRound}>+ New round</Button>
    </div>
  );
};
```

- [ ] **Step 4: Run test**

```bash
cd packages/host && npx vitest run PointlessEditor
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/components/settings/PointlessEditor.tsx packages/host/src/components/settings/PointlessEditor.test.tsx
git commit -m "feat(host): PointlessEditor — round + answer-key CRUD"
```

---

## Task 8: QuizEditor

**Files:**
- Modify: `packages/host/src/components/settings/QuizEditor.tsx`
- Test: `packages/host/src/components/settings/QuizEditor.test.tsx`

- [ ] **Step 1: Smoke test**

Create `packages/host/src/components/settings/QuizEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuizEditor } from './QuizEditor';

function mockSocket() {
  const handlers: Record<string, Function> = {};
  return {
    on: vi.fn((ev: string, cb: Function) => { handlers[ev] = cb; }),
    off: vi.fn(),
    emit: vi.fn(),
    _fire: (ev: string, payload: any) => handlers[ev]?.(payload)
  } as any;
}

const sampleOption = (id: string) => ({
  id,
  category: 'Cat',
  difficulty: 'easy',
  color: '#ff0000',
  question: 'Q?',
  answers: { A: 'a', B: 'b', C: 'c', D: 'd' },
  correct: 'A'
});

describe('QuizEditor', () => {
  it('renders rounds and lets you see options', () => {
    const s = mockSocket();
    render(<QuizEditor socket={s} />);
    s._fire('host:settings:data', {
      kind: 'quiz', version: 1,
      data: [{
        roundNumber: 1,
        enabled: true,
        options: ['a', 'b', 'c', 'd'].map(sampleOption)
      }]
    });
    expect(screen.getByText(/Round 1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, confirm failure**

```bash
cd packages/host && npx vitest run QuizEditor
```
Expected: FAIL.

- [ ] **Step 3: Implement QuizEditor**

Replace `packages/host/src/components/settings/QuizEditor.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Button, Chip } from '../../ui';

type Difficulty = 'easy' | 'medium' | 'hard' | 'impossible';

interface Option {
  id: string;
  category: string;
  difficulty: Difficulty;
  color: string;
  question: string;
  answers: { A: string; B: string; C: string; D: string };
  correct: 'A' | 'B' | 'C' | 'D';
}

interface Round {
  roundNumber: number;
  enabled: boolean;
  options: Option[];
}

interface Props { socket: Socket | null; }

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'impossible'];

export const QuizEditor = ({ socket }: Props) => {
  const [items, setItems] = useState<Round[] | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onData = (p: any) => {
      if (p?.kind !== 'quiz') return;
      setItems(p.data || []);
      setVersion(p.version || 0);
    };
    const onSaved = (p: any) => {
      if (p?.kind !== 'quiz') return;
      setVersion(p.version || 0);
      setStatus('Saved');
      setTimeout(() => setStatus(null), 1500);
    };
    const onRejected = (p: any) => {
      if (p?.kind !== 'quiz') return;
      setStatus(`Save failed: ${p.reason}${p.details ? ' — ' + p.details : ''}`);
    };
    socket.on('host:settings:data', onData);
    socket.on('host:settings:saved', onSaved);
    socket.on('host:settings:rejected', onRejected);
    socket.emit('host:settings:get', { kind: 'quiz' });
    return () => {
      socket.off('host:settings:data', onData);
      socket.off('host:settings:saved', onSaved);
      socket.off('host:settings:rejected', onRejected);
    };
  }, [socket]);

  const updateRound = (idx: number, patch: Partial<Round>) => {
    if (!items) return;
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const updateOption = (rIdx: number, oIdx: number, patch: Partial<Option>) => {
    if (!items) return;
    const r = items[rIdx];
    const opts = r.options.slice();
    opts[oIdx] = { ...opts[oIdx], ...patch };
    updateRound(rIdx, { options: opts });
  };

  const updateAnswer = (rIdx: number, oIdx: number, key: 'A'|'B'|'C'|'D', value: string) => {
    if (!items) return;
    const r = items[rIdx];
    const opts = r.options.slice();
    opts[oIdx] = { ...opts[oIdx], answers: { ...opts[oIdx].answers, [key]: value } };
    updateRound(rIdx, { options: opts });
  };

  const moveRound = (idx: number, dir: -1 | 1) => {
    if (!items) return;
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((r, i) => { r.roundNumber = i + 1; });
    setItems(next);
  };

  const removeRound = (idx: number) => {
    if (!items) return;
    if (!confirm('Delete this round (all 4 options)? Cannot be undone.')) return;
    const next = items.filter((_, i) => i !== idx);
    next.forEach((r, i) => { r.roundNumber = i + 1; });
    setItems(next);
  };

  const addRound = () => {
    if (!items) return;
    const blankOpt = (suffix: string): Option => ({
      id: 'q' + Date.now().toString(36) + suffix,
      category: '',
      difficulty: 'easy',
      color: '#888888',
      question: '',
      answers: { A: '', B: '', C: '', D: '' },
      correct: 'A'
    });
    setItems([...items, {
      roundNumber: items.length + 1,
      enabled: true,
      options: ['a', 'b', 'c', 'd'].map(blankOpt)
    }]);
  };

  const save = () => {
    if (!socket || !items) return;
    socket.emit('host:settings:save', { kind: 'quiz', data: items, version });
  };

  const reload = () => {
    if (!socket) return;
    socket.emit('host:settings:get', { kind: 'quiz' });
  };

  if (!items) return <div className="rounded-2xl border-2 border-ink bg-bg-surface p-6 text-ink-muted">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Chip variant="info">{items.length} rounds</Chip>
        <div className="flex gap-2">
          {status && <Chip variant="muted">{status}</Chip>}
          <Button variant="ghost" size="sm" onClick={reload}>Reload</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </div>

      <ul className="space-y-4">
        {items.map((r, ri) => (
          <li key={ri} className="rounded-2xl border-2 border-ink bg-bg-surface p-4 shadow-ink-sm">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={r.enabled} onChange={(e) => updateRound(ri, { enabled: e.target.checked })} />
              <span className="font-display text-lg font-extrabold">Round {r.roundNumber}</span>
              <span className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => moveRound(ri, -1)} disabled={ri === 0}>↑</Button>
              <Button variant="ghost" size="sm" onClick={() => moveRound(ri, +1)} disabled={ri === items.length - 1}>↓</Button>
              <Button variant="ghost" size="sm" onClick={() => removeRound(ri)}>✕</Button>
            </div>
            <ul className="mt-3 space-y-3">
              {r.options.map((o, oi) => (
                <li key={o.id} className="rounded-xl border border-ink/40 bg-bg-base p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input
                      type="text"
                      value={o.category}
                      onChange={(e) => updateOption(ri, oi, { category: e.target.value })}
                      placeholder="Category"
                      className="rounded border border-ink px-2 py-1 text-xs"
                    />
                    <select
                      value={o.difficulty}
                      onChange={(e) => updateOption(ri, oi, { difficulty: e.target.value as Difficulty })}
                      className="rounded border border-ink px-2 py-1 text-xs"
                    >
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      type="text"
                      value={o.color}
                      onChange={(e) => updateOption(ri, oi, { color: e.target.value })}
                      placeholder="#rrggbb"
                      className="rounded border border-ink px-2 py-1 text-xs font-mono"
                    />
                    <select
                      value={o.correct}
                      onChange={(e) => updateOption(ri, oi, { correct: e.target.value as 'A'|'B'|'C'|'D' })}
                      className="rounded border border-ink px-2 py-1 text-xs"
                    >
                      {(['A','B','C','D'] as const).map((k) => <option key={k} value={k}>Correct: {k}</option>)}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={o.question}
                    onChange={(e) => updateOption(ri, oi, { question: e.target.value })}
                    placeholder="Question"
                    className="mt-2 w-full rounded border border-ink px-2 py-1 text-sm"
                  />
                  <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {(['A','B','C','D'] as const).map((k) => (
                      <input
                        key={k}
                        type="text"
                        value={o.answers[k]}
                        onChange={(e) => updateAnswer(ri, oi, k, e.target.value)}
                        placeholder={`Answer ${k}`}
                        className="rounded border border-ink px-2 py-1 text-xs"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Button onClick={addRound}>+ New round</Button>
    </div>
  );
};
```

- [ ] **Step 4: Run test**

```bash
cd packages/host && npx vitest run QuizEditor
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/host/src/components/settings/QuizEditor.tsx packages/host/src/components/settings/QuizEditor.test.tsx
git commit -m "feat(host): QuizEditor — round + option + answer CRUD"
```

---

## Task 9: Integration sanity + final regression

- [ ] **Step 1: Type-check both packages**

```bash
cd packages/host && npx tsc --noEmit
cd ../client && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Run all server tests**

```bash
node --test tests/content-store/ tests/themed-dle/scoring.test.mjs tests/themed-dle/mode-weighting.test.mjs tests/numbers/difficulty-scoring.test.mjs tests/travel/wrong-guess-counts.test.mjs tests/pointless/early-end.test.mjs tests/pointless/host-privacy.test.mjs tests/wordle/coloring.test.mjs
```
Expected: all PASS.

- [ ] **Step 3: Run all client tests**

```bash
cd packages/host && npx vitest run
cd ../client && npx vitest run
```
Expected: all PASS.

- [ ] **Step 4: Manual smoke test**

```bash
HOST_PASSWORD=admin npm --prefix packages/server run dev &
sleep 3
```
Open `http://localhost:5174` (host), login, click "Settings", visit each tab, edit one entry per tab, save, reload, confirm it persisted. Then check the JSON file on disk now has `enabled: true` on the edited entry.

- [ ] **Step 5: Final commit (nothing new, just a marker)**

If any small fixes were needed in Step 1–3:
```bash
git add -A
git commit -m "chore: regression fixes from settings-tab integration"
```

---

## Spec Coverage Map

| Spec area | Task # |
|-----------|--------|
| `contentStore` read APIs + enabled filter | 1 |
| `contentStore` validation + atomic save + `.bak` | 2 |
| Default singleton wired to real paths | 3 |
| Game modules read through `contentStore` | 3 |
| `host:settings:get` / `:save` socket handlers | 4 |
| Host-only + lobby-only auth gates | 4 |
| Settings screen + tab nav + Dashboard entry point | 5 |
| TrueFalseEditor (CRUD + enable + reorder) | 6 |
| PointlessEditor (round + answer-key CRUD) | 7 |
| QuizEditor (round + option + 4-answer CRUD) | 8 |
| Manual sanity + regression | 9 |
