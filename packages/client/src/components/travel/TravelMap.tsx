import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';

// Name overrides: world-atlas uses different names for some countries.
// These are verified against the actual countries-110m.json feature names.
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

type Color = 'green' | 'orange' | 'red';

export interface MapChainEntry {
  name: string;
  iso?: string;
  color?: Color;
}

interface TravelMapProps {
  startName: string;
  endName: string;
  frontChain: MapChainEntry[];
  backChain: MapChainEntry[];
  solved?: boolean;
}

const FILL = {
  background: '#1e293b',   // unselected countries — dark slate
  start: '#facc15',        // yellow for start
  end: '#facc15',          // yellow for end
  green: '#16a34a',
  orange: '#f97316',
  red: '#dc2626',
};

export const TravelMap = ({ startName, endName, frontChain, backChain, solved: _solved }: TravelMapProps) => {
  // Build name → fill color lookup from the current chain state
  const nameToColor = useMemo(() => {
    const m: Record<string, string> = {};
    // Endpoints first (highest priority: yellow)
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;
    // Back chain (applied before front so front wins on overlap)
    for (const e of backChain) {
      if (e.name && e.color && !m[e.name]) m[e.name] = FILL[e.color];
    }
    // Front chain (wins over back chain on same country)
    for (const e of frontChain) {
      if (e.name && e.color) m[e.name] = FILL[e.color];
    }
    // Re-apply endpoint colors on top so start/end are always yellow
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;
    return m;
  }, [startName, endName, frontChain, backChain]);

  // Convert TopoJSON → GeoJSON feature collection once.
  // world-atlas's countries-110m.json is a Topology with an 'objects.countries' GeometryCollection.
  const featureCollection = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return feature(topology, topology.objects.countries);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [10, 20] }}
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
                  strokeWidth={0.3}
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
