// Weekend day indices per country (Date.getDay(): 0=Sun, 1=Mon, …, 5=Fri, 6=Sat)
// Countries not listed fall back to the most common global pattern: [0, 6] (Sun + Sat).
const WEEKEND_MAP: Record<string, number[]> = {
  // Fri + Sat
  AF: [5, 6],
  DZ: [5, 6],
  BH: [5, 6],
  BD: [5, 6],
  EG: [5, 6],
  IR: [5, 6],
  IQ: [5, 6],
  IL: [5, 6],
  JO: [5, 6],
  KW: [5, 6],
  LY: [5, 6],
  MV: [5, 6],
  MR: [5, 6],
  OM: [5, 6],
  PS: [5, 6],
  QA: [5, 6],
  SA: [5, 6],
  SD: [5, 6],
  SY: [5, 6],
  AE: [5, 6],
  YE: [5, 6],
  // Sat only (many countries still have Sat + Sun, but a few have Sat as the only non-working day)
  // For simplicity, Sat-only countries are grouped with Sat+Sun below
  // Sun only
  IN: [0],
  // Sat + Sun (default — listed explicitly for clarity on key markets)
  US: [0, 6],
  CA: [0, 6],
  GB: [0, 6],
  AU: [0, 6],
  DE: [0, 6],
  FR: [0, 6],
  IT: [0, 6],
  ES: [0, 6],
  NL: [0, 6],
  BR: [0, 6],
  MX: [0, 6],
  AR: [0, 6],
  JP: [0, 6],
  KR: [0, 6],
  CN: [0, 6],
  RU: [0, 6],
  TR: [0, 6],
  PL: [0, 6],
  UA: [0, 6],
  NG: [0, 6],
  ZA: [0, 6],
  PK: [0, 6], // Pakistan: official weekend is Sat+Sun (Fri used to be half-day)
  ID: [0, 6],
  PH: [0, 6],
  TH: [0, 6],
  VN: [0, 6],
  MY: [0, 6],
  SG: [0, 6],
  NZ: [0, 6],
  SE: [0, 6],
  NO: [0, 6],
  DK: [0, 6],
  FI: [0, 6],
  CH: [0, 6],
  AT: [0, 6],
  BE: [0, 6],
  PT: [0, 6],
  GR: [0, 6],
  CZ: [0, 6],
  HU: [0, 6],
  RO: [0, 6],
};

/**
 * Returns the weekend day indices (as returned by Date.getDay()) for a given
 * ISO 3166-1 alpha-2 country code. Defaults to [0, 6] (Sun + Sat) for unknown codes.
 */
export function getWeekendDays(countryCode: string | null): number[] {
  if (!countryCode) return [];
  return WEEKEND_MAP[countryCode] ?? [0, 6];
}
