/**
 * Tokenize + parse + evaluate a Numbers-Round expression with the locked rules:
 *   - Operators: + - * /
 *   - Literals: non-negative integers
 *   - Parentheses allowed
 *   - Every intermediate value must be a non-negative integer
 *   - Final result must be a non-negative integer
 *
 * Returns:
 *   { ok: true, value: number, literals: number[] }
 *   { ok: false, error: string }
 *
 * `literals` is the multiset of integer tiles referenced by the AST,
 * suitable for checking against the drawn tile multiset.
 */

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push({ kind: ch });
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < input.length && input[j] >= '0' && input[j] <= '9') j++;
      tokens.push({ kind: 'num', value: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    return { error: `unexpected character '${ch}' at position ${i}` };
  }
  return { tokens };
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = () => tokens[pos++];

  // expr := term (('+'|'-') term)*
  // term := factor (('*'|'/') factor)*
  // factor := num | '(' expr ')'

  function parseFactor() {
    const t = peek();
    if (!t) return { error: 'unexpected end of expression' };
    if (t.kind === '(') {
      eat();
      const inner = parseExpr();
      if (inner.error) return inner;
      const close = eat();
      if (!close || close.kind !== ')') return { error: 'missing closing paren' };
      return inner;
    }
    if (t.kind === 'num') {
      eat();
      return { node: { kind: 'num', value: t.value } };
    }
    return { error: `unexpected token '${t.kind}'` };
  }
  function parseTerm() {
    let left = parseFactor();
    if (left.error) return left;
    while (peek() && (peek().kind === '*' || peek().kind === '/')) {
      const op = eat().kind;
      const right = parseFactor();
      if (right.error) return right;
      left = { node: { kind: 'op', op, left: left.node, right: right.node } };
    }
    return left;
  }
  function parseExpr() {
    let left = parseTerm();
    if (left.error) return left;
    while (peek() && (peek().kind === '+' || peek().kind === '-')) {
      const op = eat().kind;
      const right = parseTerm();
      if (right.error) return right;
      left = { node: { kind: 'op', op, left: left.node, right: right.node } };
    }
    return left;
  }

  const result = parseExpr();
  if (result.error) return result;
  if (pos < tokens.length) return { error: `trailing token '${tokens[pos].kind}'` };
  return result;
}

function evalNode(node, literals) {
  if (node.kind === 'num') {
    literals.push(node.value);
    return { value: node.value };
  }
  const L = evalNode(node.left, literals);
  if (L.error) return L;
  const R = evalNode(node.right, literals);
  if (R.error) return R;
  const a = L.value;
  const b = R.value;
  let v;
  if (node.op === '+') v = a + b;
  else if (node.op === '-') v = a - b;
  else if (node.op === '*') v = a * b;
  else if (node.op === '/') {
    if (b === 0) return { error: 'division by zero' };
    if (a % b !== 0) return { error: `non-integer division ${a}/${b}` };
    v = a / b;
  } else return { error: `unknown op ${node.op}` };

  if (v < 0) return { error: `negative intermediate ${v}` };
  if (!Number.isInteger(v)) return { error: `non-integer intermediate ${v}` };
  return { value: v };
}

export function evaluate(input) {
  const tk = tokenize(input);
  if (tk.error) return { ok: false, error: tk.error };
  if (tk.tokens.length === 0) return { ok: false, error: 'empty expression' };
  const parsed = parse(tk.tokens);
  if (parsed.error) return { ok: false, error: parsed.error };
  const literals = [];
  const result = evalNode(parsed.node, literals);
  if (result.error) return { ok: false, error: result.error };
  return { ok: true, value: result.value, literals };
}

/**
 * Check that a guess's literal multiset is a subset of the available-tile multiset.
 * Returns true if every literal in `used` is present in `pool` with sufficient
 * multiplicity (and is one of the legal tile values).
 */
export function literalsFitTiles(used, tiles) {
  const remaining = new Map();
  for (const t of tiles) remaining.set(t, (remaining.get(t) || 0) + 1);
  for (const v of used) {
    const count = remaining.get(v) || 0;
    if (count === 0) return false;
    remaining.set(v, count - 1);
  }
  return true;
}
