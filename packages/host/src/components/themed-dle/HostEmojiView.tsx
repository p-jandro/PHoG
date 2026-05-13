interface HostEmojiViewProps {
  initialEmojis: string[];
  maxRevealed: number;
  fullPuzzle?: string[];
}

export const HostEmojiView = ({ initialEmojis, maxRevealed, fullPuzzle }: HostEmojiViewProps) => {
  const visible = fullPuzzle ?? initialEmojis.slice(0, Math.min(5, maxRevealed));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex gap-4 text-9xl">{visible.map((e, i) => <span key={i}>{e}</span>)}</div>
      <p className="text-2xl text-ink-muted">{visible.length}/5 emojis</p>
    </div>
  );
};
