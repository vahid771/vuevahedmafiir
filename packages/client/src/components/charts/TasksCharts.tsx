import { useTranslation } from 'react-i18next';
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer,
} from 'recharts';
import ChartCard from './ChartCard';
import { tooltipStyle, axisStyle } from './chartTheme';
import type { Task } from '../../api/tasks';

interface Props { tasks: Task[] }

export default function TasksCharts({ tasks }: Props) {
  const { t } = useTranslation();

  if (tasks.length === 0) return null;

  const open = tasks.filter(t => t.status === 'open').length;
  const done = tasks.filter(t => t.status === 'done').length;

  const statusData = [
    { name: t('charts.open'), value: open },
    { name: t('charts.done'), value: done },
  ].filter(d => d.value > 0);

  const openTasks = tasks.filter(t => t.status === 'open');
  const priorityData = [
    { name: t('charts.low'),    value: openTasks.filter(t => t.priority === 'low').length,    fill: '#22c55e' },
    { name: t('charts.medium'), value: openTasks.filter(t => t.priority === 'medium').length, fill: '#f59e0b' },
    { name: t('charts.high'),   value: openTasks.filter(t => t.priority === 'high').length,   fill: '#ef4444' },
  ];

  const STATUS_COLORS = ['#6366f1', '#22c55e'];

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Pie: open vs done */}
      <ChartCard title={t('charts.taskStatusTitle')}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%" cy="50%"
              innerRadius={50} outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {statusData.map((_, i) => (
                <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Bar: priority breakdown */}
      <ChartCard title={t('charts.taskPriorityTitle')}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={priorityData} barSize={36}>
            <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="value" name={t('charts.count')} radius={[4, 4, 0, 0]}>
              {priorityData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
