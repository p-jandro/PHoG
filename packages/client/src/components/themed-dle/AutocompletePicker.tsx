import { useMemo, useState } from 'react';

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
        if (entry.name.toLowerCase().includes(q)) return true;
        return (entry.aliases || []).some((a) => a.toLowerCase().includes(q));
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
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(suggestions.length - 1, i + 1)); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions[active]) submit(suggestions[active].name);
            else if (query.trim()) submit(query.trim());
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white placeholder:text-ui-textMuted focus:border-game-leader focus:outline-none disabled:opacity-50"
      />
      {suggestions.length > 0 && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-ui-card shadow-xl">
          {suggestions.map((entry, idx) => (
            <li
              key={entry.name}
              onMouseDown={(e) => { e.preventDefault(); submit(entry.name); }}
              onMouseEnter={() => setActive(idx)}
              className={`cursor-pointer px-4 py-3 text-lg ${idx === active ? 'bg-game-leader text-black' : 'text-white hover:bg-white/10'}`}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
