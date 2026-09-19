import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import ChartCard from './ChartCard';
import { tooltipStyle, axisStyle } from './chartTheme';
import type { Habit } from '../../api/habits';

interface Props {
  habits: Habit[];
  /** Number of days elapsed so far this week (1-7) */
  daysSoFar: number;
  /** Display name picker: 'fa' uses name_fa, otherwise name_en */
  lang: string;
}

export default function HabitsCharts({ habits, daysSoFar, lang }: Props) {
  const { t } = useTranslation();

  if (habits.length === 0) return null;

  const completionData = habits.map(h => {
    const pct = daysSoFar > 0 ? Math.round((h.logs_this_week.length / daysSoFar) * 100) : 0;
    const name = (lang === 'fa' ? h.name_fa : h.name_en) || h.name;
    // Truncate long names for axis readability
    const label = name.length > 10 ? name.slice(0, 9) + '…' : name;
    const fill = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
    return { name: label, value: pct, fill };
  });

  const streakData = habits.map(h => ({
    subject: ((lang === 'fa' ? h.name_fa : h.name_en) || h.name).slice(0, 8),
    value: h.current_streak,
  }));

  const showRadar = habits.length >= 3 && streakData.some(d => d.value > 0);

  return (
    <div className={`mt-6 grid grid-cols-1 ${showRadar ? 'sm:grid-cols-2' : ''} gap-4`}>
      {/* Bar: weekly completion % */}
      <ChartCard title={t('charts.habitCompletionTitle')}>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={completionData} barSize={28}>
            <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" width={32} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [`${v}%`, t('charts.completion')]}
              cursor={{ fill: '#f3f4f6' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {completionData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Radar: streaks (only when ≥3 habits with any streak) */}
      {showRadar && (
        <ChartCard title={t('charts.habitStreakTitle')}>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={streakData} cx="50%" cy="50%" outerRadius={75}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Radar
                name={t('charts.streak')}
                dataKey="value"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.25}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
