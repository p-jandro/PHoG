interface HostSpellViewProps {
  effect: string;
  category: string;
  incantationLength: number;
  hintsUnlocked: number;
}

export const HostSpellView = ({ effect, category, incantationLength, hintsUnlocked }: HostSpellViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
    <p className="text-2xl font-semibold uppercase tracking-[0.32em] text-ink-muted">{category}</p>
    <p className="text-5xl font-bold text-ink">{effect}</p>
    <p className="text-xl text-ink-muted">Incantation: {incantationLength} characters</p>
    <p className="text-xl text-ink-muted">Hint tier reached: {hintsUnlocked}/3</p>
  </div>
);
