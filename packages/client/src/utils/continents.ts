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
  DZ: 'africa',
  EG: 'africa',
  MA: 'africa',
  NG: 'africa',
  ZA: 'africa',

  // Middle East
  AE: 'middle-east',
  IL: 'middle-east',
  IQ: 'middle-east',
  IR: 'middle-east',
  JO: 'middle-east',
  KW: 'middle-east',
  OM: 'middle-east',
  QA: 'middle-east',
  SA: 'middle-east',

  // Asia
  AF: 'asia',
  CN: 'asia',
  ID: 'asia',
  IN: 'asia',
  JP: 'asia',
  KR: 'asia',
  KZ: 'asia',
  MY: 'asia',
  PH: 'asia',
  PK: 'asia',
  SG: 'asia',
  TH: 'asia',
  TW: 'asia',
  UZ: 'asia',
  VN: 'asia',

  // Europe
  AT: 'europe',
  BE: 'europe',
  CH: 'europe',
  CZ: 'europe',
  DE: 'europe',
  DK: 'europe',
  ES: 'europe',
  FI: 'europe',
  FR: 'europe',
  GB: 'europe',
  GR: 'europe',
  HR: 'europe',
  HU: 'europe',
  IE: 'europe',
  IT: 'europe',
  NL: 'europe',
  NO: 'europe',
  PL: 'europe',
  PT: 'europe',
  RO: 'europe',
  RS: 'europe',
  RU: 'europe',
  SE: 'europe',
  UA: 'europe',

  // North America
  CA: 'north-america',
  MX: 'north-america',
  US: 'north-america',

  // South America
  AR: 'south-america',
  BR: 'south-america',
  CL: 'south-america',
  CO: 'south-america',
  PE: 'south-america',

  // Oceania
  AU: 'oceania',
  NZ: 'oceania',
};

export const CONTINENT_VIEWPORTS: Record<
  Continent,
  { center: [number, number]; zoom: number }
> = {
  africa:        { center: [20, 5],     zoom: 3   },
  asia:          { center: [100, 35],   zoom: 2.5 },
  europe:        { center: [15, 52],    zoom: 4   },
  'north-america': { center: [-100, 45], zoom: 3  },
  'south-america': { center: [-60, -15], zoom: 3  },
  oceania:       { center: [140, -25],  zoom: 3.5 },
  'middle-east': { center: [45, 28],    zoom: 4   },
};
