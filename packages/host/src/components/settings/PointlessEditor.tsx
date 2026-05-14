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
      const normalized = (p.data || []).map((r: any) => ({ ...r, enabled: r.enabled !== false }));
      setItems(normalized);
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
