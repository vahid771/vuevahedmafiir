/** Shared colour palette and style constants for all Recharts components. */

export const CHART_COLORS = {
  blue:   '#6366f1', // indigo-500 (primary)
  green:  '#22c55e', // green-500
  amber:  '#f59e0b', // amber-500
  red:    '#ef4444', // red-500
  purple: '#a855f7', // purple-500
  teal:   '#14b8a6', // teal-500
  gray:   '#9ca3af', // gray-400
};

/** Ordered array for multi-series charts. */
export const COLOR_SEQUENCE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.purple,
  CHART_COLORS.teal,
];

export const tooltipStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  fontSize: '0.75rem',
  boxShadow: '0 1px 3px 0 rgba(0,0,0,.08)',
};

export const axisStyle = {
  fontSize: 11,
  fill: '#6b7280',
};
