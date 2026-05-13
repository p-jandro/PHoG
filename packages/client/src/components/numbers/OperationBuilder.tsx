import { Button } from '../../ui/Button';

interface OperationBuilderProps {
  aValue: number | null;
  op: string | null;
  bValue: number | null;
  onOperator: (op: string) => void;
  onCancel: () => void;
  onReset: () => void;
  disabled?: boolean;
  errorToast?: string | null;
}

const OP_BUTTONS: Array<{ value: string; label: string }> = [
  { value: '+', label: '+' },
  { value: '-', label: '−' },
  { value: '*', label: '×' },
  { value: '/', label: '÷' },
];

const Slot = ({ value, highlight }: { value: number | null | string; highlight?: boolean }) => {
  const filled = value !== null && value !== '';
  return (
    <div
      className={[
        'flex h-16 flex-1 items-center justify-center rounded-xl border-2 font-display text-2xl font-extrabold tabular-nums',
        filled
          ? highlight
            ? 'border-ink bg-now text-on-now shadow-ink'
            : 'border-ink bg-bg-surface text-ink shadow-ink'
          : 'border-dashed border-ink/30 bg-bg-sunken text-ink-muted',
      ].join(' ')}
    >
      {filled ? value : '…'}
    </div>
  );
};

export const OperationBuilder = ({
  aValue, op, bValue, onOperator, onCancel, onReset, disabled, errorToast,
}: OperationBuilderProps) => {
  const aSet = aValue !== null;
  const opSet = op !== null;
  const opLabel = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : op;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Slot value={aValue} highlight={aSet && !opSet} />
        <Slot value={opLabel ?? null} />
        <Slot value={bValue} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {OP_BUTTONS.map((o) => (
          <Button
            key={o.value}
            variant={op === o.value ? 'now' : 'ghost'}
            size="md"
            disabled={disabled || !aSet}
            onClick={() => onOperator(o.value)}
            className="border-2 border-ink"
          >
            {o.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={disabled || !aSet}
          className="border-2 border-ink"
        >
          Deselect
        </Button>
        <Button
          variant="danger"
          size="md"
          onClick={onReset}
          disabled={disabled}
        >
          Reset tiles
        </Button>
      </div>
      {errorToast && (
        <div className="rounded-xl border-2 border-ink bg-danger px-3 py-2 text-center text-sm font-bold text-on-danger shadow-ink-sm">
          {errorToast}
        </div>
      )}
    </div>
  );
};
