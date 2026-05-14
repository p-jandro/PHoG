import { useMemo, useState } from 'react';
import { Input } from '../../ui';

export interface RosterEntry {
  name: string;
  aliases?: string[];
}

interface AutocompletePickerProps {
  roster: RosterEntry[];
  onSubmit: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
}

export const AutocompletePicker = ({
  roster,
  onSubmit,
  placeholder = 'Type a name…',
  disabled = false,
  maxResults = 5
}: AutocompletePickerProps) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return roster
      .filter((entry) => {
        if (entry.name.toLowerCase().startsWith(q)) return true;
        return (entry.aliases || []).some((a) => a.toLowerCase().startsWith(q));
      })
      .slice(0, maxResults);
  }, [query, roster, maxResults]);

  const submit = (name: string) => {
    if (disabled || !name) return;
    onSubmit(name);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="relative w-full">
      <Input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault();
            setActive((i) => Math.min(suggestions.length - 1, i + 1));
          }
          if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (suggestions[active]) submit(suggestions[active].name);
            else if (query.trim()) submit(query.trim());
          }
          if (e.key === 'Escape') {
            setQuery('');
            setActive(0);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {suggestions.length > 0 && !disabled && (
        <ul className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border-2 border-ink bg-bg-surface shadow-ink">
          {suggestions.map((entry, idx) => (
            <li
              key={entry.name}
              onMouseDown={(e) => { e.preventDefault(); submit(entry.name); }}
              onMouseEnter={() => setActive(idx)}
              className={[
                'cursor-pointer px-4 py-3 text-base font-semibold',
                idx === active
                  ? 'bg-now text-on-now'
                  : 'text-ink hover:bg-bg-sunken',
              ].join(' ')}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
