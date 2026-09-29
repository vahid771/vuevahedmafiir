/**
 * Sky Scene Utility — pure JS/TS, no React imports.
 *
 * Exports all types and functions needed to compute the sky scene state
 * from the current time, timezone, and country code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkyPhase = 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SkyScene {
  /** Decimal hour 0–24 in user's local time (e.g. 14.5 = 2:30 PM). */
  hourAngle: number;
  /** True when skyPhase is not 'night'. */
  isDaytime: boolean;
  /** 0–100 percent X position of sun/moon across the sky. */
  sunMoonX: number;
  /** 0–100 percent Y position of sun/moon (0 = top, 100 = bottom). */
  sunMoonY: number;
  /** 0–1 fraction (0 = new moon, 0.5 = full moon). */
  moonPhase: number;
  season: Season;
  skyPhase: SkyPhase;
  /** True if the user's country is in the Southern Hemisphere (flips moon lit side). */
  southern: boolean;
}

// ---------------------------------------------------------------------------
// Southern Hemisphere country codes
// ---------------------------------------------------------------------------

const SOUTHERN_HEMISPHERE_CODES = new Set([
  'AR', 'AU', 'BO', 'BR', 'CL', 'EC', 'LS', 'MG', 'MW', 'MZ',
  'NA', 'NZ', 'PE', 'PY', 'ZA', 'ZM', 'ZW', 'AO', 'BW', 'BI',
  'CF', 'CG', 'KM', 'UY', 'TL', 'PG', 'PF', 'SB', 'VU', 'FJ',
  'TO', 'WS', 'TV', 'CK',
]);

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Returns decimal hour (0–24) in the user's timezone.
 * Falls back to local system time if tz is null or Intl throws.
 */
export function getLocalHour(now: Date, tz: string | null): number {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(now);

      const hour = Number(parts.find(p => p.type === 'hour')?.value ?? NaN);
      const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);

      if (!Number.isNaN(hour)) {
        // hour12: false can return 24 for midnight in some runtimes — normalise
        return (hour % 24) + minute / 60;
      }
    } catch {
      // fall through to fallback
    }
  }
  return now.getHours() + now.getMinutes() / 60;
}

/**
 * Returns the month (1–12) in the user's timezone.
 * Falls back to local system month if tz is null or Intl throws.
 */
export function getLocalMonth(now: Date, tz: string | null): number {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        month: 'numeric',
      }).formatToParts(now);

      const month = Number(parts.find(p => p.type === 'month')?.value ?? NaN);
      if (!Number.isNaN(month)) {
        return month;
      }
    } catch {
      // fall through to fallback
    }
  }
  return now.getMonth() + 1;
}

/**
 * Maps a decimal hour (0–24) to a named sky phase.
 */
export function getSkyPhase(hour: number): SkyPhase {
  if (hour < 5)  return 'night';
  if (hour < 7)  return 'dawn';
  if (hour < 10) return 'morning';
  if (hour < 16) return 'midday';
  if (hour < 19) return 'afternoon';
  if (hour < 21) return 'dusk';
  return 'night';
}

/**
 * Maps a decimal hour (0–24) to a sun/moon position on a sky arc.
 *
 * Sun arc: hours 5–21 (length 16).
 * Moon arc: hours 21–29 (i.e. 21–24 wraps to 0–5, length 8).
 *
 * Returns { x: 0–100, y: 0–100 } where y=0 is the top of the sky.
 */
export function getCelestialPosition(hour: number): { x: number; y: number } {
  const SUN_START = 5;
  const SUN_LENGTH = 16; // 5 → 21
  const MOON_START = 21;
  const MOON_LENGTH = 8; // 21 → 29 (wraps: 21–24 + 0–5)

  let t: number;
  if (hour >= SUN_START && hour <= SUN_START + SUN_LENGTH) {
    // Sun arc
    t = (hour - SUN_START) / SUN_LENGTH;
  } else {
    // Moon arc — normalise hour into 21–29 range
    const moonHour = hour >= MOON_START ? hour : hour + 24;
    t = (moonHour - MOON_START) / MOON_LENGTH;
  }

  // Clamp t to [0, 1] to guard against floating-point edge cases
  t = Math.max(0, Math.min(1, t));

  const x = t * 100;
  const y = 90 - 80 * Math.sin(t * Math.PI);

  return { x, y };
}

/**
 * Returns moon phase as a 0–1 fraction (0 = new moon, 0.5 = full moon).
 * Uses a known new-moon anchor of Jan 6, 2000 at 18:14 UTC.
 */
export function getMoonPhase(now: Date): number {
  const ANCHOR_MS = Date.UTC(2000, 0, 6, 18, 14, 0); // Jan 6 2000 18:14 UTC
  const SYNODIC_DAYS = 29.53058867;
  const SYNODIC_MS = SYNODIC_DAYS * 86400000;

  let phase = ((now.getTime() - ANCHOR_MS) / SYNODIC_MS) % 1;
  if (phase < 0) phase += 1; // handle dates before the anchor
  return phase;
}

/**
 * Returns true if the given ISO 3166-1 alpha-2 country code is in the
 * Southern Hemisphere.
 */
export function isSouthernHemisphere(countryCode: string | null): boolean {
  if (!countryCode) return false;
  return SOUTHERN_HEMISPHERE_CODES.has(countryCode.toUpperCase());
}

/**
 * Maps a month (1–12) and hemisphere flag to a season name.
 * Southern Hemisphere seasons are flipped relative to Northern.
 */
export function getSeason(month: number, southern: boolean): Season {
  let season: Season;
  if (month >= 3 && month <= 5)       season = 'spring';
  else if (month >= 6 && month <= 8)  season = 'summer';
  else if (month >= 9 && month <= 11) season = 'autumn';
  else                                season = 'winter'; // 12, 1, 2

  if (southern) {
    // Flip: spring↔autumn, summer↔winter
    if (season === 'spring')  return 'autumn';
    if (season === 'autumn')  return 'spring';
    if (season === 'summer')  return 'winter';
    if (season === 'winter')  return 'summer';
  }

  return season;
}

/**
 * Computes the full sky scene state from the current time, timezone, and
 * country code. This is the main entry point — wire all helpers together.
 */
export function computeSkyScene(
  now: Date,
  timezone: string | null,
  country: string | null,
): SkyScene {
  const hour = getLocalHour(now, timezone);
  const month = getLocalMonth(now, timezone);
  const skyPhase = getSkyPhase(hour);
  const isDaytime = skyPhase !== 'night';
  const { x: sunMoonX, y: sunMoonY } = getCelestialPosition(hour);
  const moonPhase = getMoonPhase(now);
  const southern = isSouthernHemisphere(country);
  const season = getSeason(month, southern);

  return {
    hourAngle: hour,
    isDaytime,
    sunMoonX,
    sunMoonY,
    moonPhase,
    season,
    skyPhase,
    southern,
  };
}
