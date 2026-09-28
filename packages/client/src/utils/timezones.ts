/**
 * Timezone utilities
 *
 * getAllTimezones()         — all IANA timezones from Intl API
 * getTimezoneOffset()      — formatted UTC offset string, e.g. "UTC+3:30"
 * guessTimezoneForCountry()— primary IANA timezone for a 2-letter country code
 */

/** Primary IANA timezone per ISO 3166-1 alpha-2 country code. */
export const COUNTRY_PRIMARY_TZ: Record<string, string> = {
  AF: 'Asia/Kabul',
  AL: 'Europe/Tirane',
  DZ: 'Africa/Algiers',
  AO: 'Africa/Luanda',
  AR: 'America/Argentina/Buenos_Aires',
  AM: 'Asia/Yerevan',
  AU: 'Australia/Sydney',
  AT: 'Europe/Vienna',
  AZ: 'Asia/Baku',
  BH: 'Asia/Bahrain',
  BD: 'Asia/Dhaka',
  BY: 'Europe/Minsk',
  BE: 'Europe/Brussels',
  BJ: 'Africa/Porto-Novo',
  BO: 'America/La_Paz',
  BA: 'Europe/Sarajevo',
  BR: 'America/Sao_Paulo',
  BN: 'Asia/Brunei',
  BG: 'Europe/Sofia',
  BF: 'Africa/Ouagadougou',
  KH: 'Asia/Phnom_Penh',
  CM: 'Africa/Douala',
  CA: 'America/Toronto',
  CF: 'Africa/Bangui',
  TD: 'Africa/Ndjamena',
  CL: 'America/Santiago',
  CN: 'Asia/Shanghai',
  CO: 'America/Bogota',
  CG: 'Africa/Brazzaville',
  CD: 'Africa/Kinshasa',
  CR: 'America/Costa_Rica',
  HR: 'Europe/Zagreb',
  CU: 'America/Havana',
  CY: 'Asia/Nicosia',
  CZ: 'Europe/Prague',
  DK: 'Europe/Copenhagen',
  DO: 'America/Santo_Domingo',
  EC: 'America/Guayaquil',
  EG: 'Africa/Cairo',
  SV: 'America/El_Salvador',
  ET: 'Africa/Addis_Ababa',
  EE: 'Europe/Tallinn',
  FI: 'Europe/Helsinki',
  FR: 'Europe/Paris',
  GE: 'Asia/Tbilisi',
  DE: 'Europe/Berlin',
  GH: 'Africa/Accra',
  GR: 'Europe/Athens',
  GT: 'America/Guatemala',
  GN: 'Africa/Conakry',
  HT: 'America/Port-au-Prince',
  HN: 'America/Tegucigalpa',
  HK: 'Asia/Hong_Kong',
  HU: 'Europe/Budapest',
  IS: 'Atlantic/Reykjavik',
  IN: 'Asia/Kolkata',
  ID: 'Asia/Jakarta',
  IR: 'Asia/Tehran',
  IQ: 'Asia/Baghdad',
  IE: 'Europe/Dublin',
  IL: 'Asia/Jerusalem',
  IT: 'Europe/Rome',
  CI: 'Africa/Abidjan',
  JM: 'America/Jamaica',
  JP: 'Asia/Tokyo',
  JO: 'Asia/Amman',
  KZ: 'Asia/Almaty',
  KE: 'Africa/Nairobi',
  KP: 'Asia/Pyongyang',
  KR: 'Asia/Seoul',
  KW: 'Asia/Kuwait',
  KG: 'Asia/Bishkek',
  LA: 'Asia/Vientiane',
  LV: 'Europe/Riga',
  LB: 'Asia/Beirut',
  LY: 'Africa/Tripoli',
  LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg',
  MO: 'Asia/Macau',
  MK: 'Europe/Skopje',
  MG: 'Indian/Antananarivo',
  MY: 'Asia/Kuala_Lumpur',
  MV: 'Indian/Maldives',
  ML: 'Africa/Bamako',
  MT: 'Europe/Malta',
  MR: 'Africa/Nouakchott',
  MX: 'America/Mexico_City',
  MD: 'Europe/Chisinau',
  MN: 'Asia/Ulaanbaatar',
  ME: 'Europe/Podgorica',
  MA: 'Africa/Casablanca',
  MZ: 'Africa/Maputo',
  MM: 'Asia/Rangoon',
  NA: 'Africa/Windhoek',
  NP: 'Asia/Kathmandu',
  NL: 'Europe/Amsterdam',
  NZ: 'Pacific/Auckland',
  NI: 'America/Managua',
  NE: 'Africa/Niamey',
  NG: 'Africa/Lagos',
  NO: 'Europe/Oslo',
  OM: 'Asia/Muscat',
  PK: 'Asia/Karachi',
  PA: 'America/Panama',
  PY: 'America/Asuncion',
  PE: 'America/Lima',
  PH: 'Asia/Manila',
  PL: 'Europe/Warsaw',
  PT: 'Europe/Lisbon',
  PR: 'America/Puerto_Rico',
  QA: 'Asia/Qatar',
  RO: 'Europe/Bucharest',
  RU: 'Europe/Moscow',
  RW: 'Africa/Kigali',
  SA: 'Asia/Riyadh',
  SN: 'Africa/Dakar',
  RS: 'Europe/Belgrade',
  SL: 'Africa/Freetown',
  SK: 'Europe/Bratislava',
  SI: 'Europe/Ljubljana',
  SO: 'Africa/Mogadishu',
  ZA: 'Africa/Johannesburg',
  SS: 'Africa/Juba',
  ES: 'Europe/Madrid',
  LK: 'Asia/Colombo',
  SD: 'Africa/Khartoum',
  SE: 'Europe/Stockholm',
  CH: 'Europe/Zurich',
  SY: 'Asia/Damascus',
  TW: 'Asia/Taipei',
  TJ: 'Asia/Dushanbe',
  TZ: 'Africa/Dar_es_Salaam',
  TH: 'Asia/Bangkok',
  TL: 'Asia/Dili',
  TG: 'Africa/Lome',
  TT: 'America/Port_of_Spain',
  TN: 'Africa/Tunis',
  TR: 'Europe/Istanbul',
  TM: 'Asia/Ashgabat',
  UG: 'Africa/Kampala',
  UA: 'Europe/Kiev',
  AE: 'Asia/Dubai',
  GB: 'Europe/London',
  US: 'America/New_York',
  UY: 'America/Montevideo',
  UZ: 'Asia/Tashkent',
  VE: 'America/Caracas',
  VN: 'Asia/Ho_Chi_Minh',
  YE: 'Asia/Aden',
  ZM: 'Africa/Lusaka',
  ZW: 'Africa/Harare',
};

/** Returns all IANA timezone IDs supported by the runtime. */
export function getAllTimezones(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    // Fallback for very old browsers
    return Object.values(COUNTRY_PRIMARY_TZ).filter((v, i, a) => a.indexOf(v) === i).sort();
  }
}

/**
 * Returns a formatted UTC offset string for the given IANA timezone,
 * e.g. "UTC+3:30" or "UTC-5:00".
 */
export function getTimezoneOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
    // shortOffset gives "GMT+3:30" or "GMT" — normalise to "UTC+3:30"
    return offsetPart.replace('GMT', 'UTC');
  } catch {
    return 'UTC';
  }
}

/**
 * Returns the primary IANA timezone for a 2-letter ISO country code,
 * or null if unknown.
 */
export function guessTimezoneForCountry(countryCode: string): string | null {
  return COUNTRY_PRIMARY_TZ[countryCode.toUpperCase()] ?? null;
}
