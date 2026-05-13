type LetterState = 'green' | 'yellow' | 'grey' | 'unused';

interface KeyboardProps {
  states: Record<string, 'green' | 'yellow' | 'grey'>;
  onLetter: (l: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  disabled?: boolean;
}

const ROW1 = 'qwertyuiop'.split('');
const ROW2 = 'asdfghjkl'.split('');
const ROW3 = 'zxcvbnm'.split('');

const tone = (state: LetterState) => {
  if (state === 'green') return 'bg-game-correct text-black';
  if (state === 'yellow') return 'bg-game-warning text-black';
  if (state === 'grey') return 'bg-ui-textMuted/40 text-white/50';
  return 'bg-white/10 text-white hover:bg-white/20';
};

export const Keyboard = ({ states, onLetter, onBackspace, onEnter, disabled }: KeyboardProps) => {
  const letterButton = (l: string) => (
    <button
      key={l}
      disabled={disabled}
      onClick={() => onLetter(l)}
      className={`h-12 min-w-[2rem] flex-1 rounded-md px-1 text-sm font-bold uppercase sm:h-14 sm:text-base ${tone(states[l] || 'unused')} disabled:opacity-50`}
    >
      {l}
    </button>
  );
  return (
    <div className="space-y-1.5">
      <div className="flex justify-center gap-1.5">{ROW1.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">{ROW2.map(letterButton)}</div>
      <div className="flex justify-center gap-1.5">
        <button
          disabled={disabled}
          onClick={onEnter}
          className="h-12 rounded-md bg-game-correct/80 px-3 text-xs font-bold uppercase text-black hover:brightness-110 disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          Enter
        </button>
        {ROW3.map(letterButton)}
        <button
          disabled={disabled}
          onClick={onBackspace}
          className="h-12 rounded-md bg-white/10 px-3 text-xs font-bold uppercase text-white hover:bg-white/20 disabled:opacity-50 sm:h-14 sm:text-sm"
        >
          ⌫
        </button>
      </div>
    </div>
  );
};
