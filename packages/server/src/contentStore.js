/**
 * Content store — single source of truth for editable game content.
 * Owns three JSON files: quizRounds.json, statements.json, pointless.json.
 * Provides filtered read (enabled-only) and unfiltered read (all entries),
 * plus validated atomic save.
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
    // Migration: existing files predate the `enabled` field — default it to true.
    for (const r of data) if (r && r.enabled === undefined) r.enabled = true;
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
    for (const s of data) if (s && s.enabled === undefined) s.enabled = true;
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
    for (const r of data) if (r && r.enabled === undefined) r.enabled = true;
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

// ---------- Default singleton bound to real data files ----------

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const contentStore = createContentStore({
  quizPath:       join(__dirname, 'data', 'quizRounds.json'),
  statementsPath: join(__dirname, 'data', 'statements.json'),
  pointlessPath:  join(__dirname, 'data', 'pointless.json')
});
