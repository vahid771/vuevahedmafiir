import { useState, useEffect } from 'react';
import { apiUrl, authHeaders } from '../api/base';

export interface Holiday {
  date: string;       // YYYY-MM-DD (Gregorian)
  localName: string;
  name: string;       // English name
  nameFa: string;     // Persian name (from server translation map)
  types: string[];
  hidden: boolean;
  isCustom: boolean;
}

/**
 * Returns the display name for a holiday based on the active language.
 * Falls back gracefully: fa → nameFa (else name), en → name.
 */
export function getHolidayDisplayName(h: Holiday, lang: string): string {
  if (lang === 'fa') return h.nameFa || h.name;
  return h.name;
}

// Module-level cache keyed by "CC-YYYY"
const cache = new Map<string, Holiday[]>();

// Global version counter — incremented by invalidateHolidayCache so all active
// useHolidays instances re-run their effect even if their own key wasn't affected
// (needed because the server's translation-memory means editing one year updates others).
let cacheVersion = 0;
const versionListeners = new Set<() => void>();

function notifyVersionChange() {
  cacheVersion++;
  versionListeners.forEach(fn => fn());
}

/** Remove a specific country+year from the cache and wake all useHolidays subscribers. */
export function invalidateHolidayCache(countryCode: string, year: number): void {
  cache.delete(`${countryCode}-${year}`);
  notifyVersionChange();
}

/** Wipe the entire cache for a country (all years) and wake all subscribers. */
export function invalidateAllHolidayCacheForCountry(countryCode: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${countryCode}-`)) cache.delete(key);
  }
  notifyVersionChange();
}

/**
 * Fetches public holidays for a country+year from the server proxy endpoint.
 * Re-fetches whenever the cache is invalidated, even if deps haven't changed.
 */
export function useHolidays(countryCode: string | null, year: number, token: string | null): Holiday[] {
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    if (!countryCode) return [];
    return cache.get(`${countryCode}-${year}`) ?? [];
  });

  // Track the version seen by this instance so a version bump forces a re-fetch
  const [, setVersion] = useState(cacheVersion);

  useEffect(() => {
    // Subscribe to version changes so invalidation wakes this hook
    const onInvalidate = () => setVersion(v => v + 1);
    versionListeners.add(onInvalidate);
    return () => { versionListeners.delete(onInvalidate); };
  }, []);

  useEffect(() => {
    if (!countryCode || !token) {
      setHolidays([]);
      return;
    }

    const key = `${countryCode}-${year}`;
    if (cache.has(key)) {
      setHolidays(cache.get(key)!);
      return;
    }

    let cancelled = false;
    fetch(apiUrl(`/api/holidays?country=${countryCode}&year=${year}`), {
      headers: authHeaders(token),
    })
      .then(res => {
        if (!res.ok) return [] as Holiday[];
        return res.json() as Promise<Holiday[]>;
      })
      .then(data => {
        if (cancelled) return;
        cache.set(key, data);
        setHolidays(data);
      })
      .catch(() => {
        if (!cancelled) setHolidays([]);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, year, token, cacheVersion]);

  return holidays;
}
