import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoMercator, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import { GuessPin } from './GuessPin';
import { GuessArc } from './GuessArc';

// World-atlas uses slightly different names for some countries.
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

export interface MapChainEntry {
  name: string;
  iso?: string;
  color?: Color;
}

export interface MapGuess {
  guess: string;          // country name the player typed
  answer: string;         // the correct country (for arcs)
  color: 'green' | 'orange' | 'red';
}

interface TravelMapProps {
  startName: string;
  endName: string;
  relevantNames: string[];          // viewport set
  frontChain: MapChainEntry[];
  backChain: MapChainEntry[];
  solved?: boolean;
  width?: number;
  height?: number;
  guesses?: MapGuess[];
}

const FILL = {
  unvisited: 'var(--bg-sunken)',   // in-viewport but un-guessed
  outside:   'transparent',        // hidden entirely (out-of-viewport)
  start:     'var(--now)',         // sun yellow
  end:       'var(--now)',
  green:     'var(--action)',
  orange:    'var(--warn)',
  red:       'var(--danger)',      // unused on map (reds are excluded) but kept for completeness
} as const;

const STROKE = {
  chain: 'var(--ink)',
  none:  'transparent',
} as const;

export const TravelMap = ({
  startName,
  endName,
  relevantNames,
  frontChain,
  backChain,
  solved: _solved,
  width = 600,
  height = 360,
  guesses,
}: TravelMapProps) => {
  // Convert TopoJSON → GeoJSON once.
  const featureCollection = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return feature(topology, topology.objects.countries) as any;
  }, []);

  // Compute name lookups.
  // Red entries are intentionally excluded from the chain set and color map:
  // they're "dead ends" — geographic detours that don't lead to the goal —
  // and we hide them from the map (still kept in the history list and
  // still consume a guess).
  const relevantSet = useMemo(() => new Set(relevantNames), [relevantNames]);
  const chainNames = useMemo(() => {
    const s = new Set<string>();
    if (startName) s.add(startName);
    if (endName) s.add(endName);
    for (const e of frontChain) if (e.color && e.color !== 'red') s.add(e.name);
    for (const e of backChain) if (e.color && e.color !== 'red') s.add(e.name);
    return s;
  }, [startName, endName, frontChain, backChain]);

  const nameToColor = useMemo(() => {
    const m: Record<string, string> = {};
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;
    for (const e of backChain) {
      if (e.name && e.color && e.color !== 'red' && !m[e.name]) m[e.name] = FILL[e.color];
    }
    for (const e of frontChain) {
      if (e.name && e.color && e.color !== 'red') m[e.name] = FILL[e.color];
    }
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;
    return m;
  }, [startName, endName, frontChain, backChain]);

  // Filter features to the relevant region and fit projection
  const relevantFeatures = useMemo(() => {
    if (!relevantNames || relevantNames.length === 0) return featureCollection;
    const features = featureCollection.features.filter((f: any) =>
      relevantSet.has(canonicalName(f))
    );
    return { type: 'FeatureCollection', features };
  }, [featureCollection, relevantNames, relevantSet]);

  const projection = useMemo(() => {
    const padding = 24;
    const p = geoMercator();
    if (relevantFeatures.features.length > 0) {
      // Fit to centroids, not full geometries. Countries with overseas territories
      // (e.g. France's French Guiana, Netherlands' Caribbean, etc.) would otherwise
      // pull the bounding box across continents. Centroid-based fit keeps the
      // projection focused on the mainland; outlier polygons render off-canvas
      // and are clipped by the SVG viewbox.
      const points = {
        type: 'FeatureCollection',
        features: relevantFeatures.features.map((f: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: geoCentroid(f) }
        }))
      };
      p.fitExtent([[padding, padding], [width - padding, height - padding]], points as any);
    } else {
      // Fallback to a sensible world view
      p.scale(140).center([10, 20]).translate([width / 2, height / 2]);
    }
    return p;
  }, [relevantFeatures, width, height]);

  // Compute screen-space points for guess pins and arcs
  const guessPoints = useMemo(() => {
    if (!guesses || guesses.length === 0) return [];
    const featureByName = new Map<string, any>();
    for (const f of featureCollection.features) featureByName.set(canonicalName(f), f);

    const project = (name: string) => {
      const f = featureByName.get(name);
      if (!f) return null;
      const centroid = geoCentroid(f);
      const p = projection(centroid);
      return p ? { x: p[0], y: p[1] } : null;
    };

    return guesses
      .map((g, i) => {
        const from = project(g.guess);
        const to = project(g.answer);
        if (!from || !to) return null;
        return { ...g, from, to, idx: i };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [guesses, featureCollection, projection]);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-ink bg-bg-sunken shadow-ink">
      <ComposableMap projection={projection} width={width} height={height} style={{ width: '100%', height: 'auto' }}>
        <Geographies geography={featureCollection}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const name = canonicalName(geo);
              const inViewport = relevantSet.has(name);
              const inChain = chainNames.has(name);
              if (!inViewport) {
                // Hide countries that are far outside the relevant region.
                return null;
              }
              const fill = nameToColor[name] ?? FILL.unvisited;
              const stroke = inChain ? STROKE.chain : STROKE.none;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={inChain ? 1.0 : 0}
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
        {guessPoints.length > 0 && (
          <>
            <g>
              {guessPoints.map((p) => (
                <GuessArc
                  key={`arc-${p.idx}`}
                  x1={p.from.x} y1={p.from.y}
                  x2={p.to.x}   y2={p.to.y}
                  color={p.color}
                  delaySec={p.idx * 0.12}
                />
              ))}
            </g>
            <g>
              {guessPoints.map((p) => (
                <GuessPin
                  key={`pin-${p.idx}`}
                  cx={p.from.x} cy={p.from.y}
                  color={p.color}
                  delaySec={p.idx * 0.12}
                />
              ))}
            </g>
          </>
        )}
      </ComposableMap>
    </div>
  );
};
