import { Router } from 'express';
import Groq from 'groq-sdk';
import { authenticateToken } from '../middleware/authenticate';
import { gatherUserData } from './service';
import { db } from '../db';
import {
  formatJalali,
  formatJalaliWithWeekday,
  formatJalaliWeekRange,
  formatJalaliDateTime,
} from '../utils/dates';

const router = Router();
router.use(authenticateToken);

// GET /api/ai/summary?lang=en — return lang-matched cached summary + history for that lang
router.get('/summary', async (req, res) => {
  const userId = req.user!.id;
  const lang = (req.query.lang as string) || 'en';

  const row = (await db.execute({
    sql: 'SELECT summary, summary_lang, expires_at, created_at FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ?',
    args: [userId, lang],
  })).rows[0] as unknown as { summary: string; summary_lang: string; expires_at: string; created_at: string } | undefined;

  const historyRows = (await db.execute({
    sql: `SELECT id, summary, summary_lang, expires_at, created_at
          FROM ai_summary_history
          WHERE user_id = ? AND summary_lang = ?
          ORDER BY created_at DESC
          LIMIT 10`,
    args: [userId, lang],
  })).rows as unknown as { id: number; summary: string; summary_lang: string; expires_at: string; created_at: string }[];

  if (!row) {
    res.json({ summary: null, expires_at: null, created_at: null, summary_lang: lang, history: historyRows });
    return;
  }
  res.json({ summary: row.summary, expires_at: row.expires_at, created_at: row.created_at, summary_lang: row.summary_lang, history: historyRows });
});

// PATCH /api/ai/summary — let the user edit the current summary text
router.patch('/summary', async (req, res) => {
  const userId = req.user!.id;
  const lang = (req.body?.lang as string) || 'en';
  const text: string | undefined = req.body?.summary;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'summary text is required' });
    return;
  }
  const row = (await db.execute({
    sql: 'SELECT summary, expires_at, created_at, summary_lang FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ?',
    args: [userId, lang],
  })).rows[0] as unknown as { summary: string; expires_at: string; created_at: string; summary_lang: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'No summary found for this language' });
    return;
  }

  // Push old text to history before overwriting
  await db.execute({
    sql: 'INSERT INTO ai_summary_history (user_id, summary, summary_lang, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [userId, row.summary, row.summary_lang, row.expires_at, row.created_at],
  });
  // Trim history to last 10 per user per lang
  await db.execute({
    sql: `DELETE FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND id NOT IN (
            SELECT id FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? ORDER BY created_at DESC LIMIT 10
          )`,
    args: [userId, lang, userId, lang],
  });

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE ai_summaries_lang SET summary = ?, created_at = ? WHERE user_id = ? AND summary_lang = ?',
    args: [text.trim(), now, userId, lang],
  });

  res.json({ summary: text.trim(), expires_at: row.expires_at, created_at: now, summary_lang: lang });
});

// POST /api/ai/summary
router.post('/summary', async (req, res) => {
  const userId = req.user!.id;
  const language: string = req.body?.language ?? 'en';
  const calendar: string = req.body?.calendar ?? 'miladi';
  const isFarsi = language === 'fa';
  const isShamsi = calendar === 'shamsi';

  // Date formatting helpers scoped to the chosen calendar
  const fmtDate = (dateStr: string) =>
    isShamsi ? formatJalali(dateStr) : dateStr;
  const fmtDateTime = (isoStr: string) =>
    isShamsi ? formatJalaliDateTime(isoStr) : isoStr;

  // Currency label
  const currencyLabel = isFarsi ? 'ریال' : 'IRR';

  const todayOverride: string | undefined = req.body?.today;

  const {
    today,
    weekStartStr,
    weekEndStr,
    openTasks,
    upcomingBills,
    activeSubscriptions,
    pendingReminders,
    habitsWithLogs,
    nearDates,
    upcomingLoans,
  } = await gatherUserData(userId, calendar, todayOverride);

  // "Today" and week range lines
  const todayLabel = isShamsi
    ? formatJalaliWithWeekday(today)
    : today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const weekLabel = isShamsi
    ? formatJalaliWeekRange(weekStartStr, weekEndStr)
    : `${weekStartStr} to ${weekEndStr}`;

  // Pre-compute tomorrow and day-after-tomorrow labels so the AI doesn't have to infer them
  const tomorrowDate = new Date(today.getTime() + 86400000);
  const dayAfterDate = new Date(today.getTime() + 2 * 86400000);
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);
  const dayAfterStr = dayAfterDate.toISOString().slice(0, 10);
  const tomorrowLabel = isShamsi ? formatJalali(tomorrowStr) : tomorrowStr;
  const dayAfterLabel = isShamsi ? formatJalali(dayAfterStr) : dayAfterStr;
  const todayDateLabel = isShamsi ? formatJalali(today.toISOString().slice(0, 10)) : today.toISOString().slice(0, 10);

  // Build prompt
  const lines: string[] = [
    `Today is ${todayLabel}.`,
    isFarsi
      ? `تاریخ امروز: ${todayDateLabel} | فردا: ${tomorrowLabel} | پس‌فردا: ${dayAfterLabel}`
      : `Today date: ${todayDateLabel} | Tomorrow: ${tomorrowLabel} | Day after tomorrow: ${dayAfterLabel}`,
    `Current week: ${weekLabel}.`,
    '',
    '=== OPEN TASKS ===',
  ];

  if (openTasks.length === 0) {
    lines.push('No open tasks.');
  } else {
    openTasks.forEach(t => {
      lines.push(`- [${t.priority}] ${t.title}${t.due_date ? ` (due ${fmtDate(t.due_date)})` : ''}`);
    });
  }

  lines.push('', '=== UPCOMING BILLS (next 14 days) ===');
  if (upcomingBills.length === 0) {
    lines.push('No upcoming bills.');
  } else {
    upcomingBills.forEach(b => {
        const amt = b.amount != null ? Number(b.amount).toLocaleString('en-US') + ' ' + currencyLabel : '?';
        lines.push(`- ${b.name}: ${amt} due ${fmtDate(b.due_date)} (${b.recurrence})`);
      });
  }

  lines.push('', '=== UPCOMING SUBSCRIPTIONS (next 14 days) ===');
  if (activeSubscriptions.length === 0) {
    lines.push('No upcoming subscription renewals.');
  } else {
    activeSubscriptions.forEach(s => {
        const amt = s.amount != null ? Number(s.amount).toLocaleString('en-US') + ' ' + currencyLabel : '?';
        lines.push(`- ${s.name}: ${amt} due ${fmtDate(s.next_billing_date)} (${s.billing_cycle})`);
      });
  }

  lines.push('', '=== PENDING REMINDERS (next 7 days) ===');
  if (pendingReminders.length === 0) {
    lines.push('No pending reminders.');
  } else {
    pendingReminders.forEach(r => {
      lines.push(`- ${r.title} at ${fmtDateTime(r.remind_at)}${r.notes ? ` — ${r.notes}` : ''}`);
    });
  }

  lines.push('', '=== HABITS THIS WEEK ===');
  if (habitsWithLogs.length === 0) {
    lines.push('No habits tracked.');
  } else {
    habitsWithLogs.forEach(h => {
        const habitName = isFarsi ? (h.name_fa ?? h.name) : (h.name_en ?? h.name);
        lines.push(`- ${habitName} (${h.frequency}): ${h.logsThisWeek}/${h.daysSoFar} days completed this week`);
      });
  }

  lines.push('', '=== IMPORTANT DATES (next 30 days) ===');
  if (nearDates.length === 0) {
    lines.push('No important dates in the next 30 days.');
  } else {
    nearDates.forEach(d => {
      lines.push(`- ${d.title} on ${fmtDate(d.next_occurrence)}${d.recurs_yearly ? ' (yearly)' : ''}${d.notes ? ` — ${d.notes}` : ''}`);
    });
  }

  lines.push('', '=== LOAN PAYMENTS (next 14 days) ===');
  if (upcomingLoans.length === 0) {
    lines.push('No loan payments due in the next 14 days.');
  } else {
    upcomingLoans.forEach(l => {
      const remaining = Number(l.remaining_amount).toLocaleString('en-US') + ' ' + currencyLabel;
      const installment = l.installment != null ? Number(l.installment).toLocaleString('en-US') + ' ' + currencyLabel : null;
      const lender = l.lender ? ` (${l.lender})` : '';
      const payDate = l.next_payment_date ? ` due ${fmtDate(l.next_payment_date)}` : '';
      lines.push(`- ${l.name}${lender}: ${remaining} remaining${installment ? `, installment ${installment}` : ''}${payDate}`);
    });
  }

  const prompt = lines.join('\n');
  const shamsiDateInstruction = isShamsi
    ? (isFarsi
        ? 'تمام تاریخ‌ها در داده‌ها به تقویم شمسی هستند — همان‌ها را عیناً در خروجی استفاده کنید. هرگز تاریخ میلادی یا عدد ماه ذکر نکنید.'
        : 'All dates in the data are already in the Shamsi (Jalali) calendar — copy them verbatim. Never mention Gregorian dates or numeric month numbers.')
    : '';

  const systemPrompt = isFarsi
    ? `شما یک دستیار شخصی مفید هستید. کاربر می‌خواهد بداند این هفته به چه چیزی باید توجه کند.
بر اساس داده‌های ارائه‌شده، یک خلاصه مختصر، دوستانه و اولویت‌بندی‌شده (۳ تا ۵ پاراگراف کوتاه) بنویسید.
با فوری‌ترین موارد شروع کنید. ابتدا موارد عقب‌افتاده یا آنهایی که به زودی سررسید می‌شوند را ذکر کنید.
عملی و دقیق باشید. از توضیحات کلی و بی‌محتوا پرهیز کنید. پاسخ را کاملاً به فارسی بنویسید.
تاریخ‌های امروز، فردا و پس‌فردا در متن داده‌ها به صراحت ذکر شده‌اند — از همان‌ها استفاده کنید و خودتان تاریخ محاسبه نکنید.${shamsiDateInstruction ? '\n' + shamsiDateInstruction : ''}
مبالغ را با واحد ریال بنویسید.
پاسخ را به صورت JSON با دو فیلد برگردانید:
- "summary": متن خلاصه (رشته)
- "expires_at": یک timestamp ISO 8601 که نشان می‌دهد این خلاصه تا چه زمانی معتبر است. بر اساس محتوا تصمیم بگیرید: اگر آیتم‌های فوری وجود دارد (امروز یا فردا سررسید دارند) مدت اعتبار را کوتاه‌تر (مثلاً ۶ ساعت) تعیین کنید؛ در غیر این صورت تا پایان هفته جاری.
فقط JSON خالص برگردانید، بدون توضیح اضافه.`
    : `You are a helpful personal assistant. The user wants to know what needs their attention this week.
Based on the data provided, write a concise, friendly, prioritized summary (3-5 short paragraphs).
Start with the most urgent items. Mention anything overdue or due very soon first.
Be practical and specific. Do not add fluff or generic advice.
The exact dates for today, tomorrow, and day-after-tomorrow are provided in the data — use them directly, do not compute dates yourself.${shamsiDateInstruction ? '\n' + shamsiDateInstruction : ''}
Respond with a JSON object containing exactly two fields:
- "summary": the full summary text (string)
- "expires_at": an ISO 8601 timestamp indicating when this summary should be considered stale. Use your judgment based on urgency: if there are items due today or tomorrow, set a shorter expiry (e.g. 6 hours from now); otherwise expire at end of the current week.
Return only raw JSON, no markdown fences, no extra text.`;

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
      max_tokens: 900,
    });

    const raw = completion.choices[0]?.message?.content ?? '';

    // Parse AI response — expect JSON { summary, expires_at } but fall back gracefully
    let summary: string;
    let expiresAt: string;
    try {
      // Strip markdown code fences (anywhere in the string, multiline)
      const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
      const parsed = JSON.parse(cleaned) as { summary?: string; expires_at?: string };
      summary = (parsed.summary ?? '').trim() || raw;
      expiresAt = parsed.expires_at ?? '';
    } catch {
      // JSON parse failed — the model may have returned plain text or a truncated response.
      // If the raw text looks like it starts with a JSON object, try to extract summary with regex.
      const match = raw.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
      summary = match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : raw;
      expiresAt = '';
    }

    // Validate/default expiry: must be a future ISO timestamp; default to end of current day
    const now = new Date();
    const parsed = expiresAt ? new Date(expiresAt) : null;
    const validExpiry = parsed && !isNaN(parsed.getTime()) && parsed > now ? parsed : (() => {
      const eod = new Date(now);
      eod.setHours(23, 59, 59, 999);
      return eod;
    })();
    const expiresAtFinal = validExpiry.toISOString();

    const createdAt = new Date().toISOString();

    // Push existing summary for this lang to history before overwriting
    const existingRow = (await db.execute({
      sql: 'SELECT summary, expires_at, created_at FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ?',
      args: [userId, language],
    })).rows[0] as unknown as { summary: string; expires_at: string; created_at: string } | undefined;

    if (existingRow) {
      await db.execute({
        sql: 'INSERT INTO ai_summary_history (user_id, summary, summary_lang, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [userId, existingRow.summary, language, existingRow.expires_at, existingRow.created_at],
      });
      // Keep only last 10 history entries per user per lang
      await db.execute({
        sql: `DELETE FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND id NOT IN (
                SELECT id FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? ORDER BY created_at DESC LIMIT 10
              )`,
        args: [userId, language, userId, language],
      });
    }

    // Upsert into ai_summaries_lang — one row per (user_id, summary_lang) so EN and FA are independent
    await db.execute({
      sql: `INSERT INTO ai_summaries_lang (user_id, summary_lang, summary, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, summary_lang) DO UPDATE SET
              summary    = excluded.summary,
              expires_at = excluded.expires_at,
              created_at = excluded.created_at`,
      args: [userId, language, summary, expiresAtFinal, createdAt],
    });

    res.json({ summary, expires_at: expiresAtFinal, created_at: createdAt, summary_lang: language });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Groq error:', message);
    res.status(502).json({ error: `Groq error: ${message}` });
  }
});

// POST /api/ai/habit-suggestions
// Returns ~5 habit name suggestions based on the user's existing habits.
router.post('/habit-suggestions', async (req, res) => {
  const userId = req.user!.id;
  const language: string = req.body?.language ?? 'en';
  const isFarsi = language === 'fa';

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'GROQ_API_KEY is not configured in .env' });
    return;
  }

  const rows = (await db.execute({
    sql: 'SELECT name FROM habits WHERE user_id = ?',
    args: [userId],
  })).rows as unknown as { name: string }[];

  const existingNames = rows.map(r => r.name);

  const prompt = isFarsi
    ? existingNames.length > 0
      ? `کاربر از قبل این عادت‌ها را دنبال می‌کند:\n${existingNames.map(n => `- ${n}`).join('\n')}\n\nدقیقاً ۵ عادت جدید و عملی که کاربر هنوز دنبال نمی‌کند پیشنهاد دهید. فقط یک آرایه JSON از ۵ رشته فارسی برگردانید، بدون هیچ توضیحی. مثال: ["نوشیدن ۸ لیوان آب","مطالعه ۲۰ دقیقه","مدیتیشن","ورزش","نوشتن دفترچه"]`
      : `دقیقاً ۵ عادت روزانه عملی برای شخصی که می‌خواهد سبک زندگی خود را بهبود دهد پیشنهاد دهید. فقط یک آرایه JSON از ۵ رشته فارسی برگردانید، بدون هیچ توضیحی. مثال: ["نوشیدن ۸ لیوان آب","مطالعه ۲۰ دقیقه","مدیتیشن","ورزش","نوشتن دفترچه"]`
    : existingNames.length > 0
      ? `The user already tracks these habits:\n${existingNames.map(n => `- ${n}`).join('\n')}\n\nSuggest exactly 5 new, practical habits they are NOT already tracking. Return ONLY a JSON array of 5 strings, no explanation. Example: ["Drink 8 glasses of water","Read for 20 minutes","Meditate","Exercise","Journal"]`
      : `Suggest exactly 5 practical daily habits for a person who wants to improve their lifestyle. Return ONLY a JSON array of 5 strings, no explanation. Example: ["Drink 8 glasses of water","Read for 20 minutes","Meditate","Exercise","Journal"]`;

  const habitSystemPrompt = isFarsi
    ? 'شما یک مربی عادت مفید هستید. همیشه فقط با یک آرایه JSON معتبر از رشته‌های فارسی پاسخ دهید و هیچ چیز دیگری اضافه نکنید.'
    : 'You are a helpful habit coach. Always respond with a valid JSON array of strings and nothing else.';

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: habitSystemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content ?? '[]';
    let suggestions: string[];
    try {
      suggestions = JSON.parse(raw);
      if (!Array.isArray(suggestions)) throw new Error('not an array');
      suggestions = suggestions.slice(0, 5).map(String);
    } catch {
      res.status(502).json({ error: `Failed to parse AI response: ${raw}` });
      return;
    }

    res.json({ suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Groq error:', message);
    res.status(502).json({ error: `Groq error: ${message}` });
  }
});

export default router;
