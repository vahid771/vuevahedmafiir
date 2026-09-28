import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getPreferences, updatePreferences, CalendarType } from '../api/preferences';

interface CalendarContextValue {
  calendar: CalendarType;
  setCalendar: (c: CalendarType) => Promise<void>;
  country: string | null;
  setCountry: (c: string | null) => Promise<void>;
  secondaryCalendar: CalendarType | null;
  setSecondaryCalendar: (c: CalendarType | null) => Promise<void>;
  tertiaryCalendar: CalendarType | null;
  setTertiaryCalendar: (c: CalendarType | null) => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [calendar, setCalendarState] = useState<CalendarType>('miladi');
  const [country, setCountryState] = useState<string | null>(null);
  const [secondaryCalendar, setSecondaryCalendarState] = useState<CalendarType | null>(null);
  const [tertiaryCalendar, setTertiaryCalendarState] = useState<CalendarType | null>(null);

  useEffect(() => {
    if (!token) return;
    getPreferences(token)
      .then(prefs => {
        setCalendarState(prefs.calendar);
        setCountryState(prefs.country ?? null);
        setSecondaryCalendarState(prefs.secondary_calendar ?? null);
        setTertiaryCalendarState(prefs.tertiary_calendar ?? null);
      })
      .catch(() => {/* keep defaults */});
  }, [token]);

  async function setCalendar(c: CalendarType) {
    if (!token) return;
    await updatePreferences(token, { calendar: c });
    setCalendarState(c);
  }

  async function setCountry(c: string | null) {
    if (!token) return;
    await updatePreferences(token, { country: c });
    setCountryState(c);
  }

  async function setSecondaryCalendar(c: CalendarType | null) {
    if (!token) return;
    if (c === null) {
      // Clearing secondary also clears tertiary (tertiary requires a secondary)
      await updatePreferences(token, { secondary_calendar: null, tertiary_calendar: null });
      setSecondaryCalendarState(null);
      setTertiaryCalendarState(null);
    } else {
      await updatePreferences(token, { secondary_calendar: c });
      setSecondaryCalendarState(c);
    }
  }

  async function setTertiaryCalendar(c: CalendarType | null) {
    if (!token) return;
    await updatePreferences(token, { tertiary_calendar: c });
    setTertiaryCalendarState(c);
  }

  return (
    <CalendarContext.Provider value={{
      calendar, setCalendar,
      country, setCountry,
      secondaryCalendar, setSecondaryCalendar,
      tertiaryCalendar, setTertiaryCalendar,
    }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
