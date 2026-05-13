interface HostSilhouetteViewProps {
  spriteUrl: string;
  stage: number;
}
const ZOOM       = [3.0, 2.4, 1.8, 1.4, 1.1, 1.0];
const BRIGHTNESS = [0, 0, 0.1, 0.3, 0.6, 1.0];
export const HostSilhouetteView = ({ spriteUrl, stage }: HostSilhouetteViewProps) => {
  const idx = Math.max(0, Math.min(5, stage));
  return (
    <div className="flex h-full items-center justify-center">
      <div className="aspect-square w-[40vmin] overflow-hidden rounded-3xl border border-white/10 bg-black/40">
        <img
          src={spriteUrl}
          alt="silhouette"
          style={{
            transform: `scale(${ZOOM[idx]})`,
            // Invert so a brightness=0 silhouette renders white on the dark background
            // (classic "Who's That Pokémon" look). Once brightness > 0, drop invert and
            // let the real sprite fade in.
            filter: BRIGHTNESS[idx] === 0
              ? 'brightness(0) invert(1)'
              : `brightness(${BRIGHTNESS[idx]}) saturate(${Math.min(1, BRIGHTNESS[idx] + 0.2)})`,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transition: 'all 0.5s'
          }}
        />
      </div>
    </div>
  );
};
