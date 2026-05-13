interface HostSpellViewProps {
  effect: string;
  category: string;
  incantationLength: number;
  hintsUnlocked: number;
}

export const HostSpellView = ({ effect, category, incantationLength, hintsUnlocked }: HostSpellViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
    <p className="eyebrow text-2xl">{category}</p>
    <p className="text-5xl font-bold text-white">{effect}</p>
    <p className="text-xl text-ui-textMuted">Incantation: {incantationLength} characters</p>
    <p className="text-xl text-ui-textMuted">Hint tier reached: {hintsUnlocked}/3</p>
  </div>
);
