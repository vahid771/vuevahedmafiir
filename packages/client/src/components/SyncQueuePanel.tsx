import { useEffect, useRef } from 'react';
import { useSyncQueue, type SyncJob } from '../context/SyncQueueContext';

function JobRow({ job, onDismiss }: { job: SyncJob; onDismiss: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1 text-sm">
      {/* Status icon */}
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {job.status === 'pending' && (
          <svg className="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
          </svg>
        )}
        {job.status === 'done' && (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {job.status === 'failed' && (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>

      {/* Label */}
      <span className={`flex-1 min-w-0 truncate ${
        job.status === 'done' ? 'text-gray-500' :
        job.status === 'failed' ? 'text-red-700' :
        'text-gray-700'
      }`}>
        {job.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {job.status === 'failed' && job.retry && (
          <button
            onClick={() => job.retry!()}
            className="text-xs text-blue-600 hover:underline"
          >
            Retry
          </button>
        )}
        {job.status !== 'pending' && (
          <button
            onClick={() => onDismiss(job.id)}
            className="text-gray-400 hover:text-gray-600 ml-1"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function SyncQueuePanel() {
  const { jobs, dismissJob, dismissAll } = useSyncQueue();
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPending = jobs.some(j => j.status === 'pending');
  const hasFailed = jobs.some(j => j.status === 'failed');
  const allDone = jobs.length > 0 && jobs.every(j => j.status === 'done');

  // Auto-dismiss all done jobs 3s after everything completes (no failures)
  useEffect(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    if (allDone && !hasFailed) {
      autoHideTimer.current = setTimeout(() => dismissAll(), 3000);
    }
    return () => { if (autoHideTimer.current) clearTimeout(autoHideTimer.current); };
  }, [allDone, hasFailed, dismissAll]);

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {hasPending ? 'Syncing…' : hasFailed ? 'Sync — some failed' : 'Sync complete'}
        </span>
        {!hasPending && (
          <button
            onClick={dismissAll}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Job list */}
      <div className="px-3 py-1 max-h-64 overflow-y-auto divide-y divide-gray-50">
        {jobs.map(job => (
          <JobRow key={job.id} job={job} onDismiss={dismissJob} />
        ))}
      </div>
    </div>
  );
}
