import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type SyncJobStatus = 'pending' | 'done' | 'failed';

export interface SyncLabel {
  key: string;
  vars?: Record<string, string>;
}

export interface SyncJob {
  id: string;
  label: SyncLabel;
  status: SyncJobStatus;
  retry?: () => Promise<void>;
}

interface SyncQueueContextValue {
  jobs: SyncJob[];
  addJob: (label: SyncLabel, run: () => Promise<void>) => Promise<void>;
  dismissJob: (id: string) => void;
  dismissAll: () => void;
}

const SyncQueueContext = createContext<SyncQueueContextValue | null>(null);

let counter = 0;

export function SyncQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<SyncJob[]>([]);

  const updateJob = useCallback((id: string, patch: Partial<SyncJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const addJob = useCallback(async (label: SyncLabel, run: () => Promise<void>) => {
    const id = String(++counter);
    const retry = async () => {
      updateJob(id, { status: 'pending', retry: undefined });
      try {
        await run();
        updateJob(id, { status: 'done' });
      } catch {
        updateJob(id, { status: 'failed', retry });
      }
    };

    setJobs(prev => [...prev, { id, label, status: 'pending' }]);

    try {
      await run();
      updateJob(id, { status: 'done' });
    } catch {
      updateJob(id, { status: 'failed', retry });
    }
  }, [updateJob]);

  const dismissJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setJobs(prev => prev.filter(j => j.status === 'pending'));
  }, []);

  return (
    <SyncQueueContext.Provider value={{ jobs, addJob, dismissJob, dismissAll }}>
      {children}
    </SyncQueueContext.Provider>
  );
}

export function useSyncQueue(): SyncQueueContextValue {
  const ctx = useContext(SyncQueueContext);
  if (!ctx) throw new Error('useSyncQueue must be used within SyncQueueProvider');
  return ctx;
}
