import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoMercator, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';

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

interface HostTravelMapProps {
  startName: string;
  endName: string;
  relevantNames: string[];
  visitedNamesByColor: Record<Color, Set<string>>;
  optimalChainNames?: string[];
  width?: number;
  height?: number;
}

const FILL = {
  unvisited: '#1e293b',
  start: '#facc15',
  end: '#facc15',
  green: '#16a34a',
  orange: '#f97316',
  red: '#dc2626',
  optimal: '#fbbf24'
};

const STROKE_BRIGHT = '#f8fafc';

export const HostTravelMap = ({
  startName, endName, relevantNames, visitedNamesByColor, optimalChainNames,
  width = 1100, height = 620
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

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
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
      </ComposableMap>
    </div>
  );
};
