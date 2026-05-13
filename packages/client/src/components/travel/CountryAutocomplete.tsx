import { useMemo, useState } from 'react';

export interface Country { name: string; aliases?: string[]; }

interface CountryAutocompleteProps {
  countries: Country[];
  onSubmit: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxResults?: number;
}

export const CountryAutocomplete = ({
  countries, onSubmit, disabled, placeholder = 'Type a country…', maxResults = 5
}: CountryAutocompleteProps) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        return (c.aliases || []).some((a) => a.toLowerCase().includes(q));
      })
      .slice(0, maxResults);
  }, [query, countries, maxResults]);

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
        disabled={disabled}
        placeholder={placeholder}
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
          if (e.key === 'Escape') { setQuery(''); setActive(0); }
        }}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg text-white placeholder:text-ui-textMuted focus:border-game-leader focus:outline-none disabled:opacity-50"
      />
      {suggestions.length > 0 && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-white/10 bg-ui-card shadow-xl">
          {suggestions.map((c, idx) => (
            <li
              key={c.name}
              onMouseDown={(e) => { e.preventDefault(); submit(c.name); }}
              onMouseEnter={() => setActive(idx)}
              className={`cursor-pointer px-4 py-3 text-lg ${idx === active ? 'bg-game-leader text-black' : 'text-white hover:bg-white/10'}`}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
