import { useState, useEffect } from 'react';
import { apiUrl, authHeaders } from '../api/base';

// Module-level cache — weekend days are stable within a session
const cache = new Map<string, number[]>();

/** Remove a country from the weekends cache so the next useWeekends call re-fetches. */
export function invalidateWeekendsCache(countryCode: string): void {
  cache.delete(countryCode);
}

/**
 * Returns the weekend day indices (Date.getDay()) for a given country.
 * Fetches from /api/holidays/weekends which uses CLDR data server-side.
 * Falls back to [0, 6] (Sat+Sun) while loading or on error.
 */
export function useWeekends(countryCode: string | null, token: string | null): number[] {
  const [weekendDays, setWeekendDays] = useState<number[]>(() => {
    if (!countryCode) return [];
    return cache.get(countryCode) ?? [];
  });

  useEffect(() => {
    if (!countryCode || !token) {
      setWeekendDays([]);
      return;
    }

    if (cache.has(countryCode)) {
      setWeekendDays(cache.get(countryCode)!);
      return;
    }

    let cancelled = false;
    fetch(apiUrl(`/api/holidays/weekends?country=${countryCode}`), {
      headers: authHeaders(token),
    })
      .then(res => {
        if (!res.ok) return { weekendDays: [0, 6] };
        return res.json() as Promise<{ weekendDays: number[] }>;
      })
      .then(data => {
        if (cancelled) return;
        cache.set(countryCode, data.weekendDays);
        setWeekendDays(data.weekendDays);
      })
      .catch(() => {
        if (!cancelled) setWeekendDays([0, 6]);
      });

    return () => { cancelled = true; };
  }, [countryCode, token]);

  return weekendDays;
}
