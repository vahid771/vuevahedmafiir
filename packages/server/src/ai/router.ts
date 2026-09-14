import { Router } from 'express';
import Groq from 'groq-sdk';
import { authenticateToken } from '../middleware/authenticate';
import { gatherUserData } from './service';

const router = Router();
router.use(authenticateToken);

// POST /api/ai/summary
router.post('/summary', async (req, res) => {
  const userId = req.user!.id;

  const {
    today,
    mondayStr,
    sundayStr,
    openTasks,
    upcomingBills,
    activeSubscriptions,
    pendingReminders,
    habitsWithLogs,
    nearDates,
  } = await gatherUserData(userId);

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
