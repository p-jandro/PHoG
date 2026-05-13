import { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoMercator, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';

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

interface TravelMapProps {
  startName: string;
  endName: string;
  relevantNames: string[];          // viewport set
  frontChain: MapChainEntry[];
  backChain: MapChainEntry[];
  solved?: boolean;
  width?: number;
  height?: number;
}

const FILL = {
  unvisited: '#1e293b',    // dim slate — in viewport but not in chain
  outside: 'transparent',  // far away — hide entirely
  start: '#facc15',
  end: '#facc15',
  green: '#16a34a',
  orange: '#f97316',
  red: '#dc2626'
};

const STROKE = {
  chain: '#f8fafc',        // bright stroke for chain countries
  none: 'transparent'      // unvisited get no border
};

export const TravelMap = ({
  startName,
  endName,
  relevantNames,
  frontChain,
  backChain,
  solved: _solved,
  width = 600,
  height = 360
}: TravelMapProps) => {
  // Convert TopoJSON → GeoJSON once.
  const featureCollection = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection }>;
    return feature(topology, topology.objects.countries) as any;
  }, []);

  // Compute name lookups
  const relevantSet = useMemo(() => new Set(relevantNames), [relevantNames]);
  const chainNames = useMemo(() => {
    const s = new Set<string>();
    if (startName) s.add(startName);
    if (endName) s.add(endName);
    for (const e of frontChain) if (e.color) s.add(e.name);
    for (const e of backChain) if (e.color) s.add(e.name);
    return s;
  }, [startName, endName, frontChain, backChain]);

  const nameToColor = useMemo(() => {
    const m: Record<string, string> = {};
    if (startName) m[startName] = FILL.start;
    if (endName) m[endName] = FILL.end;
    for (const e of backChain) {
      if (e.name && e.color && !m[e.name]) m[e.name] = FILL[e.color];
    }
    for (const e of frontChain) {
      if (e.name && e.color) m[e.name] = FILL[e.color];
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

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
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
      </ComposableMap>
    </div>
  );
};
