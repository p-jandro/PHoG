const PALETTE = ['#4a7adf', '#2ec27e', '#d96a3a', '#5b3a5b', '#ffd23f', '#e54848'] as const;

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 'md',
  className = '',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const bg = colorForKey(name);
  const sizeCls =
    size === 'sm' ? 'h-7 w-7 text-xs' :
    size === 'lg' ? 'h-12 w-12 text-base' :
                    'h-9 w-9 text-sm';
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full border-2 border-ink font-extrabold text-white shadow-ink-sm',
        sizeCls,
        className,
      ].join(' ')}
      style={{ background: bg, color: bg === '#ffd23f' ? '#181614' : '#ffffff' }}
      title={name}
      aria-label={name}
    >
      {initialsFor(name)}
    </span>
  );
}
