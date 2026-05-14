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
