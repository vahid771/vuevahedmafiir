import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getPreferences, updatePreferences, CalendarType } from '../api/preferences';

interface CalendarContextValue {
  calendar: CalendarType;
  setCalendar: (c: CalendarType) => Promise<void>;
  country: string | null;
  setCountry: (c: string | null) => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [calendar, setCalendarState] = useState<CalendarType>('miladi');
  const [country, setCountryState] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getPreferences(token)
      .then(prefs => {
        setCalendarState(prefs.calendar);
        setCountryState(prefs.country ?? null);
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

  return (
    <CalendarContext.Provider value={{ calendar, setCalendar, country, setCountry }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
