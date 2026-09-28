export type Continent =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'oceania'
  | 'middle-east';

export const CONTINENT_LABELS: Record<Continent, string> = {
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  'north-america': 'North America',
  'south-america': 'South America',
  oceania: 'Oceania',
  'middle-east': 'Middle East',
};

export const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  // Africa
  DZ: 'africa', AO: 'africa', BJ: 'africa', BW: 'africa', BF: 'africa',
  BI: 'africa', CM: 'africa', CV: 'africa', CF: 'africa', TD: 'africa',
  KM: 'africa', CG: 'africa', CD: 'africa', CI: 'africa', DJ: 'africa',
  EG: 'africa', GQ: 'africa', ER: 'africa', ET: 'africa', GA: 'africa',
  GM: 'africa', GH: 'africa', GN: 'africa', GW: 'africa', KE: 'africa',
  LS: 'africa', LR: 'africa', LY: 'africa', MG: 'africa', MW: 'africa',
  ML: 'africa', MR: 'africa', MU: 'africa', YT: 'africa', MA: 'africa',
  MZ: 'africa', NA: 'africa', NE: 'africa', NG: 'africa', RE: 'africa',
  RW: 'africa', SH: 'africa', ST: 'africa', SN: 'africa', SC: 'africa',
  SL: 'africa', SO: 'africa', ZA: 'africa', SS: 'africa', SD: 'africa',
  SZ: 'africa', TZ: 'africa', TG: 'africa', TN: 'africa', UG: 'africa',
  EH: 'africa', ZM: 'africa', ZW: 'africa',

  // Middle East
  AE: 'middle-east', BH: 'middle-east', IL: 'middle-east', IQ: 'middle-east',
  IR: 'middle-east', JO: 'middle-east', KW: 'middle-east', LB: 'middle-east',
  OM: 'middle-east', PS: 'middle-east', QA: 'middle-east', SA: 'middle-east',
  SY: 'middle-east', TR: 'middle-east', YE: 'middle-east',

  // Asia
  AF: 'asia', AM: 'asia', AZ: 'asia', BD: 'asia', BT: 'asia',
  BN: 'asia', KH: 'asia', CN: 'asia', GE: 'asia', HK: 'asia',
  IN: 'asia', ID: 'asia', JP: 'asia', KZ: 'asia', KG: 'asia',
  LA: 'asia', MO: 'asia', MY: 'asia', MV: 'asia', MN: 'asia',
  MM: 'asia', NP: 'asia', KP: 'asia', KR: 'asia', PK: 'asia',
  PH: 'asia', SG: 'asia', LK: 'asia', TJ: 'asia', TH: 'asia',
  TL: 'asia', TM: 'asia', TW: 'asia', UZ: 'asia', VN: 'asia',

  // Europe
  AL: 'europe', AD: 'europe', AT: 'europe', BY: 'europe', BE: 'europe',
  BA: 'europe', BG: 'europe', HR: 'europe', CY: 'europe', CZ: 'europe',
  DK: 'europe', EE: 'europe', FO: 'europe', FI: 'europe', FR: 'europe',
  DE: 'europe', GI: 'europe', GR: 'europe', GG: 'europe', HU: 'europe',
  IS: 'europe', IE: 'europe', IM: 'europe', IT: 'europe', JE: 'europe',
  XK: 'europe', LV: 'europe', LI: 'europe', LT: 'europe', LU: 'europe',
  MK: 'europe', MT: 'europe', MD: 'europe', MC: 'europe', ME: 'europe',
  NL: 'europe', NO: 'europe', PL: 'europe', PT: 'europe', RO: 'europe',
  RU: 'europe', SM: 'europe', RS: 'europe', SK: 'europe', SI: 'europe',
  ES: 'europe', SE: 'europe', CH: 'europe', UA: 'europe', GB: 'europe',
  VA: 'europe',

  // North America
  AI: 'north-america', AG: 'north-america', AW: 'north-america', BS: 'north-america',
  BB: 'north-america', BZ: 'north-america', BM: 'north-america', VG: 'north-america',
  CA: 'north-america', KY: 'north-america', CR: 'north-america', CU: 'north-america',
  CW: 'north-america', DM: 'north-america', DO: 'north-america', SV: 'north-america',
  GL: 'north-america', GD: 'north-america', GP: 'north-america', GT: 'north-america',
  HT: 'north-america', HN: 'north-america', JM: 'north-america', MQ: 'north-america',
  MX: 'north-america', MS: 'north-america', CL: 'north-america', NI: 'north-america',
  PA: 'north-america', PR: 'north-america', BL: 'north-america', KN: 'north-america',
  LC: 'north-america', MF: 'north-america', PM: 'north-america', VC: 'north-america',
  SX: 'north-america', TT: 'north-america', TC: 'north-america', US: 'north-america',
  VI: 'north-america',

  // South America
  AR: 'south-america', BO: 'south-america', BR: 'south-america', CO: 'south-america',
  EC: 'south-america', FK: 'south-america', GF: 'south-america', GY: 'south-america',
  PY: 'south-america', PE: 'south-america', SR: 'south-america', UY: 'south-america',
  VE: 'south-america',

  // Oceania
  AS: 'oceania', AU: 'oceania', CK: 'oceania', FJ: 'oceania', PF: 'oceania',
  GU: 'oceania', KI: 'oceania', MH: 'oceania', FM: 'oceania', NR: 'oceania',
  NC: 'oceania', NZ: 'oceania', NU: 'oceania', NF: 'oceania', MP: 'oceania',
  PW: 'oceania', PG: 'oceania', PN: 'oceania', WS: 'oceania', SB: 'oceania',
  TK: 'oceania', TO: 'oceania', TV: 'oceania', VU: 'oceania', WF: 'oceania',
};

export const CONTINENT_VIEWPORTS: Record<
  Continent,
  { center: [number, number]; zoom: number }
> = {
  africa:          { center: [20, 5],     zoom: 3   },
  asia:            { center: [100, 35],   zoom: 2.5 },
  europe:          { center: [15, 52],    zoom: 4   },
  'north-america': { center: [-90, 45],   zoom: 2.5 },
  'south-america': { center: [-60, -15],  zoom: 3   },
  oceania:         { center: [140, -25],  zoom: 3.5 },
  'middle-east':   { center: [45, 28],    zoom: 4   },
};
