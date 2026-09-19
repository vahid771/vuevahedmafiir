import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import ChartCard from './ChartCard';
import { tooltipStyle, axisStyle, CHART_COLORS } from './chartTheme';
import type { Task } from '../../api/tasks';
import type { Habit } from '../../api/habits';
import type { Bill, Loan } from '../../api/bills';

interface UpcomingItem {
  label: string;
  amount: number;
  daysUntil: number;
}

interface Props {
  tasks: Task[];
  habits: Habit[];
  bills: Bill[];
  loans: Loan[];
  /** Number of days elapsed so far this week (1-7) */
  daysSoFar: number;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / 86400000);
}

export default function DashboardCharts({ tasks, habits, bills, loans, daysSoFar }: Props) {
  const { t } = useTranslation();

  // ── Stat mini-cards data ──────────────────────────────────────────────────
  const openCount = tasks.filter(t => t.status === 'open').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const totalTasks = openCount + doneCount;

  const avgCompletion = habits.length > 0 && daysSoFar > 0
    ? Math.round(habits.reduce((s, h) => s + h.logs_this_week.length, 0) / (habits.length * daysSoFar) * 100)
    : 0;

  const unpaidBills = bills.filter(b => !b.paid);
  const unpaidTotal = unpaidBills.reduce((s, b) => s + (b.amount ?? 0), 0);

  // ── Task status donut data ────────────────────────────────────────────────
  const taskPieData = [
    { name: t('charts.open'), value: openCount },
    { name: t('charts.done'), value: doneCount },
  ].filter(d => d.value > 0);
  const PIE_COLORS = [CHART_COLORS.blue, CHART_COLORS.green];

  // ── Upcoming payments bar (next 14 days) ─────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming: UpcomingItem[] = [];
  bills.filter(b => !b.paid && b.due_date).forEach(b => {
    const du = daysUntil(b.due_date!);
    if (du >= 0 && du <= 14) upcoming.push({ label: b.name, amount: b.amount ?? 0, daysUntil: du });
  });
  loans.filter(l => l.active && l.remaining_amount > 0 && l.next_payment_date).forEach(l => {
    const du = daysUntil(l.next_payment_date!);
    if (du >= 0 && du <= 14) upcoming.push({ label: l.name, amount: l.installment ?? l.remaining_amount, daysUntil: du });
  });
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
  const upcomingBarData = upcoming.map(u => ({
    name: u.label.length > 12 ? u.label.slice(0, 11) + '…' : u.label,
    [t('charts.amount')]: u.amount,
  }));
  const amtKey = t('charts.amount');

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(v);

  return (
    <div className="mt-6 space-y-4">
      {/* Stat mini-cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Tasks */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('dashboard.tasks')}</p>
          {totalTasks > 0 ? (
            <div className="flex items-center gap-2">
              <div style={{ width: 52, height: 52 }}>
                <PieChart width={52} height={52}>
                  <Pie data={taskPieData} cx={22} cy={22} innerRadius={14} outerRadius={24} dataKey="value" paddingAngle={2}>
                    {taskPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % 2]} />)}
                  </Pie>
                </PieChart>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 leading-none">{openCount}</p>
                <p className="text-xs text-gray-400">{t('charts.open')}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('charts.noData')}</p>
          )}
        </div>

        {/* Habits */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('dashboard.habits')}</p>
          <p className="text-2xl font-bold text-gray-800">{avgCompletion}<span className="text-sm font-normal text-gray-400">%</span></p>
          <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${avgCompletion}%`,
                backgroundColor: avgCompletion >= 80 ? CHART_COLORS.green : avgCompletion >= 50 ? CHART_COLORS.amber : CHART_COLORS.red,
              }}
            />
          </div>
        </div>

        {/* Unpaid bills */}
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('dashboard.bills')}</p>
          <p className="text-2xl font-bold text-gray-800">{unpaidBills.length}</p>
          {unpaidTotal > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{fmtCurrency(unpaidTotal)}</p>
          )}
        </div>
      </div>

      {/* Upcoming payments bar chart */}
      {upcomingBarData.length > 0 && (
        <ChartCard title={t('charts.upcomingPaymentsTitle')}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={upcomingBarData} barSize={28}>
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={0} tickFormatter={() => ''} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmtCurrency(Number(v)), amtKey]} cursor={{ fill: '#f3f4f6' }} />
              <Bar dataKey={amtKey} fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
