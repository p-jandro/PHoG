/**
 * Content store — single source of truth for editable game content.
 * Owns three JSON files: quizRounds.json, statements.json, pointless.json.
 * Provides filtered read (enabled-only) and unfiltered read (all entries).
 * Save APIs added in Task 2.
 */
import { readFileSync } from 'node:fs';

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
    getPointlessRoundsAll:() => pointless
  };
}
