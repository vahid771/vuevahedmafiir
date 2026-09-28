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

/** Numeric ISO 3166-1 → alpha-2 (full world coverage) */
const NUMERIC_TO_ALPHA2: Record<string, string> = {
  '004':'AF','008':'AL','012':'DZ','016':'AS','020':'AD','024':'AO','028':'AG',
  '031':'AZ','032':'AR','036':'AU','040':'AT','044':'BS','048':'BH','050':'BD',
  '051':'AM','056':'BE','060':'BM','064':'BT','068':'BO','070':'BA','072':'BW',
  '076':'BR','096':'BN','100':'BG','104':'MM','108':'BI','116':'KH','120':'CM',
  '124':'CA','132':'CV','140':'CF','144':'LK','152':'CL','156':'CN','170':'CO',
  '174':'KM','178':'CG','180':'CD','188':'CR','191':'HR','192':'CU','196':'CY',
  '203':'CZ','204':'BJ','208':'DK','212':'DM','214':'DO','218':'EC','222':'SV',
  '226':'GQ','231':'ET','232':'ER','233':'EE','238':'FK','246':'FI','250':'FR',
  '266':'GA','270':'GM','268':'GE','276':'DE','288':'GH','300':'GR','308':'GD',
  '320':'GT','324':'GN','328':'GY','332':'HT','340':'HN','348':'HU','356':'IN',
  '360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','380':'IT','384':'CI',
  '388':'JM','392':'JP','400':'JO','398':'KZ','404':'KE','296':'KI','408':'KP',
  '410':'KR','414':'KW','417':'KG','418':'LA','422':'LB','426':'LS','430':'LR',
  '434':'LY','428':'LV','440':'LT','442':'LU','450':'MG','454':'MW','458':'MY',
  '462':'MV','466':'ML','470':'MT','478':'MR','480':'MU','484':'MX','496':'MN',
  '498':'MD','499':'ME','504':'MA','508':'MZ','516':'NA','524':'NP','528':'NL',
  '540':'NC','554':'NZ','558':'NI','562':'NE','566':'NG','578':'NO','512':'OM',
  '586':'PK','585':'PW','591':'PA','598':'PG','600':'PY','604':'PE','608':'PH',
  '616':'PL','620':'PT','630':'PR','634':'QA','642':'RO','643':'RU','646':'RW',
  '659':'KN','662':'LC','670':'VC','682':'SA','686':'SN','688':'RS','694':'SL',
  '702':'SG','703':'SK','704':'VN','705':'SI','706':'SO','710':'ZA','716':'ZW',
  '724':'ES','728':'SS','729':'SD','740':'SR','752':'SE','756':'CH','760':'SY',
  '762':'TJ','764':'TH','768':'TG','776':'TO','780':'TT','784':'AE','788':'TN',
  '792':'TR','795':'TM','800':'UG','804':'UA','807':'MK','818':'EG','826':'GB',
  '840':'US','858':'UY','860':'UZ','862':'VE','887':'YE','894':'ZM','112':'BY',
  '352':'IS','158':'TW',
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
    if (!alpha2) return 'default';
    if (!continentView) {
      return COUNTRY_TO_CONTINENT[alpha2] ? 'pointer' : 'default';
    }
    // Continent view: any country in this continent is selectable
    return COUNTRY_TO_CONTINENT[alpha2] === continentView ? 'pointer' : 'default';
  }

  function handleGeoClick(alpha2: string | undefined) {
    if (!alpha2) return;
    if (!continentView) {
      const continent = COUNTRY_TO_CONTINENT[alpha2];
      if (continent) setContinentView(continent);
    } else {
      if (COUNTRY_TO_CONTINENT[alpha2] === continentView) {
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
