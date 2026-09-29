import { useMemo } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { computeSkyScene, type SkyScene } from '../utils/skyScene';

/**
 * Derives the sky scene state from the user's timezone and country.
 * Re-computes whenever timezone or country changes (useMemo).
 * The `now` timestamp is captured at memo evaluation time (on mount + deps change).
 */
export function useSkyScene(): SkyScene {
  const { timezone, country } = useCalendar();

  return useMemo(
    () => computeSkyScene(new Date(), timezone, country),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timezone, country],
  );
}
