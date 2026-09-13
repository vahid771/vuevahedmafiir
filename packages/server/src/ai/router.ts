import { Router } from 'express';
import Groq from 'groq-sdk';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

// POST /api/ai/summary
router.post('/summary', async (req, res) => {
  const userId = req.user!.id;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in14 = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  // Gather data from all modules
  const openTasks = db
    .prepare("SELECT title, due_date, priority FROM tasks WHERE user_id = ? AND status = 'open' ORDER BY due_date ASC NULLS LAST, priority DESC LIMIT 20")
    .all(userId) as { title: string; due_date: string | null; priority: string }[];

  const upcomingBills = db
    .prepare("SELECT name, amount, due_date, recurrence FROM bills WHERE user_id = ? AND paid = 0 AND due_date <= ? ORDER BY due_date ASC")
    .all(userId, in14) as { name: string; amount: number | null; due_date: string; recurrence: string }[];

  const activeSubscriptions = db
    .prepare("SELECT name, amount, billing_cycle, next_billing_date FROM subscriptions WHERE user_id = ? AND active = 1 AND next_billing_date <= ? ORDER BY next_billing_date ASC")
    .all(userId, in14) as { name: string; amount: number | null; billing_cycle: string; next_billing_date: string }[];

  const pendingReminders = db
    .prepare("SELECT title, remind_at, notes FROM reminders WHERE user_id = ? AND done = 0 AND remind_at <= ? ORDER BY remind_at ASC")
    .all(userId, new Date(today.getTime() + 7 * 86400000).toISOString()) as { title: string; remind_at: string; notes: string | null }[];

  const habits = db
    .prepare('SELECT id, name, frequency FROM habits WHERE user_id = ?')
    .all(userId) as { id: number; name: string; frequency: string }[];

  // Week bounds
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const habitsWithLogs = habits.map(h => {
    const logs = db
      .prepare('SELECT logged_date FROM habit_logs WHERE habit_id = ? AND user_id = ? AND logged_date BETWEEN ? AND ?')
      .all(h.id, userId, mondayStr, sundayStr) as { logged_date: string }[];
    const daysSoFar = Math.min(day === 0 ? 7 : day, 7);
    return { ...h, logsThisWeek: logs.length, daysSoFar };
  });

  const upcomingDates = db
    .prepare('SELECT title, date, recurs_yearly, notes FROM important_dates WHERE user_id = ?')
    .all(userId) as { title: string; date: string; recurs_yearly: number; notes: string | null }[];

  // Compute next_occurrence for each date and filter to within 30 days
  const nearDates = upcomingDates
    .map(d => {
      const base = new Date(d.date + 'T00:00:00');
      if (d.recurs_yearly) {
        base.setFullYear(today.getFullYear());
        if (base < today) base.setFullYear(today.getFullYear() + 1);
      }
      return { ...d, next_occurrence: base.toISOString().slice(0, 10) };
    })
    .filter(d => d.next_occurrence >= todayStr && d.next_occurrence <= in30)
    .sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));

  // Build prompt
  const lines: string[] = [
    `Today is ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    `Current week: ${mondayStr} to ${sundayStr}.`,
    '',
    '=== OPEN TASKS ===',
  ];

  if (openTasks.length === 0) {
    lines.push('No open tasks.');
  } else {
    openTasks.forEach(t => {
      lines.push(`- [${t.priority}] ${t.title}${t.due_date ? ` (due ${t.due_date})` : ''}`);
    });
  }

  lines.push('', '=== UPCOMING BILLS (next 14 days) ===');
  if (upcomingBills.length === 0) {
    lines.push('No upcoming bills.');
  } else {
    upcomingBills.forEach(b => {
      lines.push(`- ${b.name}: $${b.amount ?? '?'} due ${b.due_date} (${b.recurrence})`);
    });
  }

  lines.push('', '=== UPCOMING SUBSCRIPTIONS (next 14 days) ===');
  if (activeSubscriptions.length === 0) {
    lines.push('No upcoming subscription renewals.');
  } else {
    activeSubscriptions.forEach(s => {
      lines.push(`- ${s.name}: $${s.amount ?? '?'} due ${s.next_billing_date} (${s.billing_cycle})`);
    });
  }

  lines.push('', '=== PENDING REMINDERS (next 7 days) ===');
  if (pendingReminders.length === 0) {
    lines.push('No pending reminders.');
  } else {
    pendingReminders.forEach(r => {
      lines.push(`- ${r.title} at ${r.remind_at}${r.notes ? ` — ${r.notes}` : ''}`);
    });
  }

  lines.push('', '=== HABITS THIS WEEK ===');
  if (habitsWithLogs.length === 0) {
    lines.push('No habits tracked.');
  } else {
    habitsWithLogs.forEach(h => {
      lines.push(`- ${h.name} (${h.frequency}): ${h.logsThisWeek}/${h.daysSoFar} days completed this week`);
    });
  }

  lines.push('', '=== IMPORTANT DATES (next 30 days) ===');
  if (nearDates.length === 0) {
    lines.push('No important dates in the next 30 days.');
  } else {
    nearDates.forEach(d => {
      lines.push(`- ${d.title} on ${d.next_occurrence}${d.recurs_yearly ? ' (yearly)' : ''}${d.notes ? ` — ${d.notes}` : ''}`);
    });
  }

  const prompt = lines.join('\n');
  const systemPrompt = `You are a helpful personal assistant. The user wants to know what needs their attention this week. 
Based on the data provided, write a concise, friendly, prioritized summary (3-5 short paragraphs). 
Start with the most urgent items. Mention anything overdue or due very soon first.
Be practical and specific. Do not add fluff or generic advice.`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GROQ_API_KEY is not configured in .env' });
      return;
    }
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 600,
    });

    const summary = completion.choices[0]?.message?.content ?? 'No summary generated.';
    res.json({ summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Groq error:', message);
    res.status(502).json({ error: `Groq error: ${message}` });
  }
});

export default router;
