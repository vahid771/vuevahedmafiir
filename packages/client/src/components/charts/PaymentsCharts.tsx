import { useTranslation } from 'react-i18next';
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard';
import { tooltipStyle, axisStyle } from './chartTheme';
import type { Bill } from '../../api/bills';
import type { Loan } from '../../api/bills';

// ─── Bills paid/unpaid pie ─────────────────────────────────────────────────────

interface BillsChartsProps { bills: Bill[] }

export function BillsCharts({ bills }: BillsChartsProps) {
  const { t } = useTranslation();

  const withAmount = bills.filter(b => b.amount != null);
  if (withAmount.length === 0) return null;

  const paidTotal   = withAmount.filter(b => b.paid).reduce((s, b) => s + (b.amount ?? 0), 0);
  const unpaidTotal = withAmount.filter(b => !b.paid).reduce((s, b) => s + (b.amount ?? 0), 0);

  if (paidTotal === 0 && unpaidTotal === 0) return null;

  const data = [
    { name: t('charts.paidAmount'),   value: paidTotal,   fill: '#22c55e' },
    { name: t('charts.unpaidAmount'), value: unpaidTotal, fill: '#ef4444' },
  ].filter(d => d.value > 0);

  const fmt = (v: number) =>
    new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(v);

  return (
    <div className="mt-4">
      <ChartCard title={t('charts.billsPaidTitle')} collapsible defaultOpen>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={50} outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)), '']} />
            <PieChart>
              {/* legend rendered via tooltip only */}
            </PieChart>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-1 text-xs text-gray-500">
          {data.map(d => (
            <span key={d.name} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.fill }} />
              {d.name}: {fmt(d.value)}
            </span>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

// ─── Loans stacked bar ─────────────────────────────────────────────────────────

interface LoansChartsProps { loans: Loan[] }

export function LoansCharts({ loans }: LoansChartsProps) {
  const { t } = useTranslation();

  const active = loans.filter(l => l.active && l.total_amount > 0);
  if (active.length === 0) return null;

  const data = active.map(l => {
    const paidAmt = l.total_amount - l.remaining_amount;
    return {
      name: l.name.length > 12 ? l.name.slice(0, 11) + '…' : l.name,
      [t('charts.paid')]:      Math.max(0, paidAmt),
      [t('charts.remaining')]: Math.max(0, l.remaining_amount),
    };
  });

  const paidKey      = t('charts.paid');
  const remainingKey = t('charts.remaining');

  return (
    <div className="mt-4">
      <ChartCard title={t('charts.loanProgressTitle')} collapsible defaultOpen>
        <ResponsiveContainer width="100%" height={Math.max(180, active.length * 48)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 8 }}
            barSize={18}
          >
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey={paidKey}      stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
            <Bar dataKey={remainingKey} stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block bg-indigo-500" />{paidKey}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block bg-gray-200" />{remainingKey}</span>
        </div>
      </ChartCard>
    </div>
  );
}
