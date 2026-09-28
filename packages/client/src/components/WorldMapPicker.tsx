import { useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import {
  CONTINENT_VIEWPORTS,
  COUNTRY_TO_CONTINENT,
} from '../utils/continents';
import type { Continent } from '../utils/continents';
import FlagImg from './FlagImg';

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Only the 65 supported country codes
const COUNTRY_CODES = new Set<string>([
  'AF','DZ','AR','AU','AT','BE','BR','CA','CL','CN','CO','HR','CZ','DK',
  'EG','FI','FR','DE','GR','HU','IN','ID','IR','IQ','IE','IL','IT','JP',
  'JO','KZ','KW','MY','MX','MA','NL','NZ','NG','NO','OM','PK','PE','PH',
  'PL','PT','QA','RO','RU','SA','RS','SG','ZA','KR','ES','SE','CH','TW',
  'TH','TR','UA','AE','GB','US','UZ','VN',
]);

/** Numeric ISO 3166-1 → alpha-2 for the countries we care about */
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '004':'AF','012':'DZ','032':'AR','036':'AU','040':'AT','056':'BE','076':'BR',
  '124':'CA','152':'CL','156':'CN','170':'CO','191':'HR','203':'CZ','208':'DK',
  '818':'EG','246':'FI','250':'FR','276':'DE','300':'GR','348':'HU','356':'IN',
  '360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','380':'IT','392':'JP',
  '400':'JO','398':'KZ','414':'KW','458':'MY','484':'MX','504':'MA','528':'NL',
  '554':'NZ','566':'NG','578':'NO','512':'OM','586':'PK','604':'PE','608':'PH',
  '616':'PL','620':'PT','634':'QA','642':'RO','643':'RU','682':'SA','688':'RS',
  '702':'SG','710':'ZA','410':'KR','724':'ES','752':'SE','756':'CH','158':'TW',
  '764':'TH','792':'TR','804':'UA','784':'AE','826':'GB','840':'US','860':'UZ','704':'VN',
};

const CONTINENT_COLORS: Record<Continent, string> = {
  africa:           '#fcd34d',
  asia:             '#86efac',
  europe:           '#93c5fd',
  'north-america':  '#f9a8d4',
  'south-america':  '#fdba74',
  oceania:          '#c4b5fd',
  'middle-east':    '#6ee7b7',
};

/** Darken a hex colour by reducing each channel by ~15% */
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 38);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 38);
  const b = Math.max(0, (n         & 0xff) - 38);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function getCountryName(alpha2: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(alpha2) ?? alpha2;
  } catch {
    return alpha2;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorldMapPickerProps {
  selected: string | null;
  onSelect: (code: string) => void;
  lang: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorldMapPicker({ selected, onSelect, lang }: WorldMapPickerProps) {
  const [continentView, setContinentView] = useState<Continent | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewport = continentView ? CONTINENT_VIEWPORTS[continentView] : null;

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseLeaveContainer() {
    setHovered(null);
    setTooltipPos(null);
  }

  function getFillColor(alpha2: string | undefined): string {
    // Selected country: always blue
    if (alpha2 && alpha2 === selected) return '#3b82f6';

    if (!continentView) {
      // World view: colour by continent
      const continent = alpha2 ? COUNTRY_TO_CONTINENT[alpha2] : undefined;
      if (!continent) return '#e5e7eb';
      return CONTINENT_COLORS[continent];
    } else {
      // Continent view
      const continent = alpha2 ? COUNTRY_TO_CONTINENT[alpha2] : undefined;
      if (!continent || continent !== continentView) return '#f3f4f6';
      const base = CONTINENT_COLORS[continent];
      if (alpha2 === hovered) return darken(base);
      return base;
    }
  }

  function getCursor(alpha2: string | undefined): string {
    if (!continentView) {
      // World view: clickable if it belongs to any continent
      return alpha2 && COUNTRY_TO_CONTINENT[alpha2] ? 'pointer' : 'default';
    }
    // Continent view: only selectable countries in this continent
    if (alpha2 && COUNTRY_TO_CONTINENT[alpha2] === continentView && COUNTRY_CODES.has(alpha2)) {
      return 'pointer';
    }
    return 'default';
  }

  function handleGeoClick(alpha2: string | undefined) {
    if (!alpha2) return;
    if (!continentView) {
      const continent = COUNTRY_TO_CONTINENT[alpha2];
      if (continent) setContinentView(continent);
    } else {
      if (COUNTRY_TO_CONTINENT[alpha2] === continentView && COUNTRY_CODES.has(alpha2)) {
        onSelect(alpha2);
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
      style={{ height: '320px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeaveContainer}
    >
      {/* Back button */}
      {continentView && (
        <button
          onClick={() => { setContinentView(null); setHovered(null); setTooltipPos(null); }}
          className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          type="button"
        >
          ← Back
        </button>
      )}

      <ComposableMap
        projectionConfig={{ scale: 147 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={viewport ? viewport.center : [0, 20]}
          zoom={viewport ? viewport.zoom : 1}
          minZoom={viewport ? viewport.zoom : 1}
          maxZoom={viewport ? viewport.zoom : 1}
          filterZoomEvent={() => false}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id);
                const alpha2 = NUMERIC_TO_ALPHA2[numericId];
                const fill = getFillColor(alpha2);
                const cursor = getCursor(alpha2);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    style={{ outline: 'none', cursor }}
                    onMouseEnter={() => {
                      if (alpha2) setHovered(alpha2);
                    }}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleGeoClick(alpha2)}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip */}
      {hovered && tooltipPos && (
        <div
          className="pointer-events-none absolute z-20 flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-100 shadow-md"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 32,
            whiteSpace: 'nowrap',
          }}
        >
          <FlagImg code={hovered} />
          <span>{getCountryName(hovered, lang)}</span>
        </div>
      )}
    </div>
  );
}
