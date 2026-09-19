import { useState } from 'react';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export default function ChartCard({ title, children, collapsible = false, defaultOpen = true }: ChartCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${collapsible ? 'cursor-pointer select-none hover:bg-gray-50' : ''}`}
        onClick={collapsible ? () => setOpen(v => !v) : undefined}
      >
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {collapsible && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}
