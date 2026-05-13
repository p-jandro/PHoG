import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoMercator, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import { GuessPin } from './GuessPin';
import { GuessArc } from './GuessArc';

const NAME_OVERRIDES: Record<string, string> = {
  'United States of America': 'United States',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Central African Rep.': 'Central African Republic',
  'Czechia': 'Czech Republic',
  "Côte d'Ivoire": 'Ivory Coast',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Congo': 'Republic of the Congo',
  'Eq. Guinea': 'Equatorial Guinea',
  'Macedonia': 'North Macedonia',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'eSwatini': 'Eswatini'
};

const canonicalName = (geo: { properties: { name: string } }) =>
  NAME_OVERRIDES[geo.properties.name] || geo.properties.name;

type Color = 'green' | 'orange' | 'red';

// Keep HostChainEntry exported for backward-compat with any import in TravelDisplay
export interface HostChainEntry {
  name: string;
  iso?: string;
  color?: Color;
}

export interface HostMapGuess {
  guess: string;
  answer: string;            // intent.target (next hop on shortest path) or start/end fallback
  color: 'green' | 'orange' | 'red';
  playerId: string;          // for unique React keys
}

interface HostTravelMapProps {
  startName: string;
  endName: string;
  relevantNames: string[];
  visitedNamesByColor: Record<Color, Set<string>>;
  optimalChainNames?: string[];
  width?: number;
  height?: number;
  playerGuesses?: HostMapGuess[];
}

const FILL = {
  unvisited: 'var(--bg-sunken)',
  start:     'var(--now)',
  end:       'var(--now)',
  green:     'var(--action)',
  orange:    'var(--warn)',
  red:       'var(--danger)',
  optimal:   'var(--streak)',   // heritage terracotta — celebration only
} as const;

const STROKE_BRIGHT = 'var(--ink)';

export const HostTravelMap = ({
  startName, endName, relevantNames, visitedNamesByColor, optimalChainNames,
  width = 1100, height = 620,
  playerGuesses,
}: HostTravelMapProps) => {
  const featureCollection = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return feature(topology, topology.objects.countries) as any;
  }, []);

  const relevantSet = useMemo(() => {
    const s = new Set(relevantNames);
    if (optimalChainNames) for (const n of optimalChainNames) s.add(n);
    return s;
  }, [relevantNames, optimalChainNames]);

  // Reds are intentionally hidden — they're "dead-end" detours that don't lead
  // to the goal. Players still see them in the history list, but the map skips
  // them (no fill, no border — same as never-visited).
  const fillFor = (name: string): { fill: string; isVisited: boolean } => {
    if (optimalChainNames?.includes(name) && name !== startName && name !== endName) {
      return { fill: FILL.optimal, isVisited: true };
    }
    if (name === startName) return { fill: FILL.start, isVisited: true };
    if (name === endName) return { fill: FILL.end, isVisited: true };
    if (visitedNamesByColor.green.has(name)) return { fill: FILL.green, isVisited: true };
    if (visitedNamesByColor.orange.has(name)) return { fill: FILL.orange, isVisited: true };
    return { fill: FILL.unvisited, isVisited: false };
  };

  const relevantFeatures = useMemo(() => {
    if (relevantSet.size === 0) return featureCollection;
    const features = featureCollection.features.filter((f: any) => relevantSet.has(canonicalName(f)));
    return { type: 'FeatureCollection', features };
  }, [featureCollection, relevantSet]);

  const projection = useMemo(() => {
    const padding = 40;
    const p = geoMercator();
    if (relevantFeatures.features.length > 0) {
      // Fit to centroids only — see TravelMap.tsx for rationale (avoids overseas
      // territories like French Guiana pulling the bounding box across continents).
      const points = {
        type: 'FeatureCollection',
        features: relevantFeatures.features.map((f: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: geoCentroid(f) }
        }))
      };
      p.fitExtent([[padding, padding], [width - padding, height - padding]], points as any);
    } else {
      p.scale(180).center([10, 20]).translate([width / 2, height / 2]);
    }
    return p;
  }, [relevantFeatures, width, height]);

  // Compute screen-space points for player guess pins and arcs
  const points = useMemo(() => {
    if (!playerGuesses || playerGuesses.length === 0) return [];
    const featureByName = new Map<string, any>();
    for (const f of featureCollection.features) featureByName.set(canonicalName(f), f);

    const project = (name: string) => {
      const f = featureByName.get(name);
      if (!f) return null;
      const centroid = geoCentroid(f);
      const p = projection(centroid);
      return p ? { x: p[0], y: p[1] } : null;
    };

    return playerGuesses
      .map((g) => {
        const from = project(g.guess);
        const to = project(g.answer);
        if (!from || !to) return null;
        return { ...g, from, to };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [playerGuesses, featureCollection, projection]);

  // Compute start/end screen-space points for labels
  const { startPoint, endPoint } = useMemo(() => {
    const featureByName = new Map<string, any>();
    for (const f of featureCollection.features) featureByName.set(canonicalName(f), f);

    const project = (name: string) => {
      const f = featureByName.get(name);
      if (!f) return null;
      const centroid = geoCentroid(f);
      const p = projection(centroid);
      return p ? { x: p[0], y: p[1] } : null;
    };

    return {
      startPoint: project(startName),
      endPoint: project(endName),
    };
  }, [featureCollection, projection, startName, endName]);

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-ink bg-bg-sunken shadow-ink-lg">
      <ComposableMap projection={projection} width={width} height={height} style={{ width: '100%', height: 'auto' }}>
        <Geographies geography={featureCollection}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const name = canonicalName(geo);
              if (!relevantSet.has(name)) return null;
              const { fill, isVisited } = fillFor(name);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={isVisited ? STROKE_BRIGHT : 'transparent'}
                  strokeWidth={isVisited ? 1.2 : 0}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' }
                  }}
                />
              );
            })
          }
        </Geographies>
        {points.length > 0 && (
          <>
            <g>
              {points.map((p, i) => (
                <GuessArc
                  key={`arc-${p.playerId}-${i}`}
                  x1={p.from.x} y1={p.from.y}
                  x2={p.to.x}   y2={p.to.y}
                  color={p.color}
                  delaySec={Math.min(i * 0.04, 1.2)}
                />
              ))}
            </g>
            <g>
              {points.map((p, i) => (
                <GuessPin
                  key={`pin-${p.playerId}-${i}`}
                  cx={p.from.x} cy={p.from.y}
                  color={p.color}
                  delaySec={Math.min(i * 0.04, 1.2)}
                />
              ))}
            </g>
          </>
        )}
        {/* Start/end full-text labels */}
        {startPoint && (
          <g>
            <rect x={startPoint.x - 60} y={startPoint.y + 12} width={120} height={24}
                  rx={6} fill="var(--bg-surface)" stroke="var(--ink)" strokeWidth={2} />
            <text x={startPoint.x} y={startPoint.y + 28}
                  textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">
              Start: {startName}
            </text>
          </g>
        )}
        {endPoint && (
          <g>
            <rect x={endPoint.x - 60} y={endPoint.y + 12} width={120} height={24}
                  rx={6} fill="var(--bg-surface)" stroke="var(--ink)" strokeWidth={2} />
            <text x={endPoint.x} y={endPoint.y + 28}
                  textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--ink)">
              End: {endName}
            </text>
          </g>
        )}
      </ComposableMap>
    </div>
  );
};
