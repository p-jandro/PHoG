interface HostGridViewProps {
  rows: string[];
  cols: string[];
  reveal?: Record<string, string[]>;
}

export const HostGridView = ({ rows, cols, reveal }: HostGridViewProps) => (
  <div className="flex h-full flex-col items-center justify-center">
    <table className="border-separate border-spacing-2">
      <thead>
        <tr>
          <th />
          {cols.map((c) => (
            <th
              key={c}
              className="w-44 max-w-44 overflow-hidden break-words px-2 py-2 text-center font-extrabold leading-tight align-middle"
              style={{ fontSize: 'clamp(0.8rem, 1.4vw, 1.4rem)' }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r}>
            <th
              className="w-40 max-w-40 overflow-hidden break-words pr-3 text-center font-extrabold leading-tight align-middle"
              style={{ fontSize: 'clamp(0.8rem, 1.4vw, 1.4rem)' }}
            >
              {r}
            </th>
            {cols.map((_, ci) => {
              const answers = reveal?.[`${ri},${ci}`] || [];
              return (
                <td key={ci} className="h-28 w-44 rounded-2xl border-2 border-white/10 bg-black/30 px-2 py-1 align-top text-xs">
                  {answers.slice(0, 4).map((a) => <div key={a}>{a}</div>)}
                  {answers.length > 4 && <div className="text-ink-muted">+{answers.length - 4}</div>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
