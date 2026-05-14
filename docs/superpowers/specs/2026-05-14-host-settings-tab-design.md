# Host Settings Tab — 2026-05-14

A settings panel inside the host control app that lets the host edit the question/statement/answer pool used by Quiz, True/False, and Pointless. Backed by a library model with on/off toggles so questions can be parked without being deleted.

## Goals

- Host can add, edit, delete, and reorder entries for Quiz, T/F, and Pointless.
- Host can toggle individual entries on/off; only enabled entries participate in gameplay.
- Edits persist across server restarts.
- No new password / route — reuses host socket authentication.
- Settings tab is only accessible in the `lobby` phase.

## Non-goals

- Editing Pokédle/HP-dle/Wordle/Travel/Numbers data. (Those are larger structured datasets — out of scope.)
- Versioned history beyond a single `.bak` snapshot.
- Multi-user editing or merge conflict resolution.

## Architecture

### Server

- New module `packages/server/src/contentStore.js`. Single source of truth for the three editable data files. Public surface:
  - `getQuizRounds()` / `getStatements()` / `getPointlessRounds()` — returns the in-memory parsed JSON. Each is filtered to `enabled: true` entries at call time (so disabled entries are still in the file but never returned to game modules).
  - `getQuizRoundsAll()` / `getStatementsAll()` / `getPointlessRoundsAll()` — returns the full library (enabled + disabled), used only by the settings panel.
  - `saveQuizRounds(data)` / `saveStatements(data)` / `savePointlessRounds(data)` — validates, writes a `.bak` of the previous file, atomic-writes the new content to disk, updates the in-memory cache, returns `{ ok, version }` or `{ ok: false, reason }`.
  - `getVersion(kind)` — file mtime in ms; used for optimistic concurrency.
- `quiz.js`, `trueFalse.js`, `pointless.js` are refactored to import from `contentStore` rather than reading their JSON files directly. On each round/statement pick they call `contentStore.getX()` so a save mid-session takes effect from the next pick onward.
- New host socket events (`packages/server/src/index.js`):
  - `host:settings:get { kind }` → host receives `host:settings:data { kind, data, version }`.
  - `host:settings:save { kind, data, version }` → server validates and saves; replies `host:settings:saved { kind, version }` or `host:settings:rejected { kind, reason, details? }`.
  - Both gated on `socket.id === gameState.meta.hostSocketId && gameState.phase === 'lobby'`. Non-host or non-lobby sockets receive `host:settings:rejected { reason: 'not_authorized' }` / `reason: 'wrong_phase'`.

### Client (host)

- New screen `packages/host/src/screens/Settings.tsx`.
- Routing: a "Settings" button in the Dashboard header (visible only when authenticated and `gameState.phase === 'lobby'`). Clicking switches Dashboard ↔ Settings via local state, no new router.
- Three sub-tabs inside Settings:
  - **Quiz** — `packages/host/src/components/settings/QuizEditor.tsx`
  - **True/False** — `packages/host/src/components/settings/TrueFalseEditor.tsx`
  - **Pointless** — `packages/host/src/components/settings/PointlessEditor.tsx`
- Each editor receives initial data via `host:settings:get { kind }` on tab mount.
- Each editor has its own "Save" / "Discard" / "Reload" controls, scoped to that tab.
- Reorder via up/down arrow buttons next to each entry (no drag-and-drop dependency).
- Add new entry via "+ New" button at the bottom of each list; opens an inline form pre-filled with a sane default. Save adds to the list at the end.
- Delete is one click + confirm dialog ("Delete this question? This cannot be undone.").
- Enable/disable toggle (switch) per entry. Toggling auto-saves immediately (no Save button needed for that one bit) — the switch optimistically flips, the server confirms or reverts.

## Data shape changes

Add `enabled: true` to every existing entry, plus an `id` when missing. Server defaults `enabled` to `true` if absent, so old files keep working.

### Quiz

`packages/server/src/data/quizRounds.json` — each round gains `enabled`:
```json
[
  {
    "roundNumber": 1,
    "enabled": true,
    "options": [ /* exactly 4 options, unchanged */ ]
  }
]
```
On-disk file is the full library. Game uses `rounds.filter(r => r.enabled !== false)` and walks that filtered array sequentially. `totalQuestions` is clamped to `Math.min(currentTotal, enabledRounds.length)` at game start so the game can't ask for more rounds than exist.

Quiz validation rules:
- Every round: `roundNumber: integer >= 1`, `enabled: boolean`, `options: [exactly 4 objects]`.
- Every option: `id: non-empty string`, `category: non-empty`, `difficulty ∈ {easy, medium, hard, impossible}`, `color: /^#[0-9A-Fa-f]{6}$/`, `question: non-empty`, `answers: { A, B, C, D }` all non-empty strings, `correct ∈ {A,B,C,D}`.

### True/False

`packages/server/src/data/statements.json` — each statement gains `enabled`:
```json
{
  "id": "tf001",
  "statement": "Mercury is the closest planet to the Sun.",
  "answer": true,
  "explanation": "…",
  "enabled": true
}
```
Game samples from `statements.filter(s => s.enabled !== false)`. Server constant `totalStatements: 20` is clamped to `Math.min(20, enabledCount)`; if fewer than 20 are enabled the round ends early at whatever is available.

T/F validation rules:
- `id: non-empty string` (auto-generated if missing on save)
- `statement: non-empty`
- `answer: boolean`
- `explanation: string` (may be empty)
- `enabled: boolean`

### Pointless

`packages/server/src/data/pointless.json` — each round gains `enabled`:
```json
{
  "id": "round_1_south_america",
  "category": "…",
  "question": "…",
  "answers": { "brazil": 100, ... },
  "enabled": true
}
```
Game iterates only enabled rounds. Total rounds played = `Math.min(currentRoundCount, enabled.length)`.

Pointless validation:
- `id: non-empty string`
- `category: non-empty`
- `question: non-empty`
- `answers: object with >= 4 entries, each value an integer 0-100`
- Answer keys are case-insensitive unique (no `"Brazil"` + `"brazil"`).
- `enabled: boolean`

## Data flow

```
Host clicks "Settings"
  Dashboard hides, Settings mounts
  Settings tab (Quiz) mounts QuizEditor
    QuizEditor → socket.emit('host:settings:get', { kind: 'quiz' })
    server: contentStore.getQuizRoundsAll() + getVersion('quiz')
    server → socket.emit('host:settings:data', { kind: 'quiz', data, version })
    QuizEditor receives, holds local working copy in state

Edits → local React state only
Save click:
  QuizEditor → socket.emit('host:settings:save', { kind: 'quiz', data, version })
  server: validate; if ok: write .bak, atomic write, update cache, ++version
  server → 'host:settings:saved' { kind, version: newVersion }  (success)
       or 'host:settings:rejected' { kind, reason, details }    (failure)
  Editor swaps local version to newVersion on success.

Game module on next pick:
  quiz.js: contentRound = contentStore.getQuizRounds()[questionNumber]
  trueFalse.js: pool = contentStore.getStatements().filter(notUsed)
  pointless.js: contentStore.getPointlessRounds()[roundIndex]
```

## Migration

On server startup, `contentStore` loads each file. For any entry missing `enabled`, it treats it as `enabled: true` in memory. The first time a user saves through the settings UI, the file is rewritten with explicit `enabled` fields. No separate migration script needed.

If a file is missing or malformed JSON, server logs an error and uses an empty array — host sees an empty editor and can populate.

## Error handling

- Invalid payload from client → `host:settings:rejected { reason: 'validation', details: { path: '...', message: '...' } }`. Client surfaces inline next to the offending field.
- File write fails (disk full, permissions) → `reason: 'write_failed'`. In-memory cache stays on the previous value. Client shows toast: "Couldn't save — disk error. Your edits are still here."
- Stale version (someone else edited / disk changed) → `reason: 'stale_version'`. Client offers "Reload from disk" which re-fetches and discards local edits.
- Editing while a non-lobby phase begins → server emits a `host:settings:rejected { reason: 'wrong_phase' }` and the Settings tab auto-closes back to Dashboard.

## Testing

**Server (`tests/content-store/`):**
- `validation.test.mjs` — happy + each rejection path per kind (12+ cases).
- `atomic-write.test.mjs` — write produces a `.bak`, the main file matches input.
- `enabled-filter.test.mjs` — getX() filters out `enabled: false`; getXAll() returns everything; defaults missing `enabled` to true.
- `integration.test.mjs` — save through socket → quiz module sees new content on next round.

**Client (`packages/host/src/components/settings/`):**
- Smoke test per editor: mount with sample data, edit one field, click Save, assert the emitted socket payload.

## Out of scope follow-ups

- Bulk import/export (CSV, paste-from-clipboard).
- Search/filter within editors.
- Tag-based question groups (mentioned in brainstorming, deferred).
- Edit history beyond the single `.bak`.
- Editing Pokédle/HP-dle/Wordle/Travel/Numbers content.
