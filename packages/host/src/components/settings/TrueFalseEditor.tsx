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
      const normalized = (p.data || []).map((s: any) => ({ ...s, enabled: s.enabled !== false }));
      setItems(normalized);
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
