import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';

// Name overrides: world-atlas country names → our canonical names.
// Verified against the actual feature names in countries-110m.json.
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
  'eSwatini': 'Eswatini',
};

const canonicalName = (geo: { properties: { name: string } }) =>
  NAME_OVERRIDES[geo.properties.name] || geo.properties.name;

const FILL = {
  background: '#1e293b',   // unvisited countries
  start: '#facc15',        // yellow for start endpoint
  end: '#facc15',          // yellow for end endpoint
  green: '#16a34a',
  orange: '#f97316',
  red: '#dc2626',
  optimal: '#fbbf24',      // gold for the optimal path reveal
};

export interface HostChainEntry {
  name: string;
  iso?: string;
  color?: 'green' | 'orange' | 'red';
}

interface HostTravelMapProps {
  startName: string;
  endName: string;
  /** All players' frontChain and backChain entries aggregated for coloring */
  allChainEntries: HostChainEntry[];
  /** During results phase, highlight the optimal path in gold */
  optimalChainNames?: string[];
}

export const HostTravelMap = ({
  startName,
  endName,
  allChainEntries,
  optimalChainNames,
}: HostTravelMapProps) => {
  // Build name → fill color lookup
  const nameToColor = useMemo(() => {
    const m: Record<string, string> = {};

    // Apply all player chain colors (green > orange > red priority)
    const priority: Record<string, number> = {};
    const colorPriority = { green: 3, orange: 2, red: 1 };

    for (const e of allChainEntries) {
      if (!e.name || !e.color) continue;
      const p = colorPriority[e.color] ?? 0;
      if ((priority[e.name] ?? 0) < p) {
        priority[e.name] = p;
        m[e.name] = FILL[e.color];
      }
    }

    // Optimal path overlay (results phase) — gold, but not endpoints
    if (optimalChainNames) {
      for (const name of optimalChainNames) {
        if (name !== startName && name !== endName) {
          m[name] = FILL.optimal;
        }
      }
    }

    // Endpoints always yellow (highest priority)
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;

    return m;
  }, [startName, endName, allChainEntries, optimalChainNames]);

  // Convert TopoJSON → GeoJSON once.
  const featureCollection = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return feature(topology, topology.objects.countries);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 160, center: [10, 20] }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={featureCollection}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; properties: { name: string } }> }) =>
            geographies.map((geo) => {
              const name = canonicalName(geo);
              const fill = nameToColor[name] ?? FILL.background;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#334155"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none' },
                    pressed: { outline: 'none' },
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
