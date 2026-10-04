import { useState, useCallback } from 'react';

/**
 * Encapsulates the loading / error / data trio that every data-fetching page
 * repeats.  Call `run(fn)` to execute an async function: it sets loading=true,
 * awaits fn(), stores the result, catches errors as a string, and always clears
 * loading.
 */
export function useAsyncState<T>(initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const run = useCallback(async (fn: () => Promise<T>): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const result = await fn();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, setData, loading, error, setError, run };
}
