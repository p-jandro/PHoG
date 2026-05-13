interface HostClassicViewProps {
  attributes: string[];
}

export const HostClassicView = ({ attributes }: HostClassicViewProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-6">
    <h2 className="text-5xl font-bold">Guess the hidden answer</h2>
    <p className="text-2xl text-ink-muted">Match these attributes:</p>
    <div className="flex flex-wrap justify-center gap-3">
      {attributes.map((a) => (
        <span key={a} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xl">{a}</span>
      ))}
    </div>
  </div>
);
