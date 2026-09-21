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

// GET /api/ai/summary?lang=en&calendar=miladi — return lang+calendar-matched cached summary + history
router.get('/summary', async (req, res) => {
  const userId = req.user!.id;
  const lang = (req.query.lang as string) || 'en';
  const calendar = (req.query.calendar as string) || 'miladi';

  const row = (await db.execute({
    sql: 'SELECT summary, summary_lang, summary_calendar, expires_at, created_at FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?',
    args: [userId, lang, calendar],
  })).rows[0] as unknown as { summary: string; summary_lang: string; summary_calendar: string; expires_at: string; created_at: string } | undefined;

  const historyRows = (await db.execute({
    sql: `SELECT id, summary, summary_lang, summary_calendar, expires_at, created_at
          FROM ai_summary_history
          WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?
          ORDER BY created_at DESC
          LIMIT 10`,
    args: [userId, lang, calendar],
  })).rows as unknown as { id: number; summary: string; summary_lang: string; summary_calendar: string; expires_at: string; created_at: string }[];

  if (!row) {
    res.json({ summary: null, expires_at: null, created_at: null, summary_lang: lang, summary_calendar: calendar, history: historyRows });
    return;
  }
  res.json({ summary: row.summary, expires_at: row.expires_at, created_at: row.created_at, summary_lang: row.summary_lang, summary_calendar: row.summary_calendar, history: historyRows });
});

// PATCH /api/ai/summary — let the user edit the current summary text
router.patch('/summary', async (req, res) => {
  const userId = req.user!.id;
  const lang = (req.body?.lang as string) || 'en';
  const calendar = (req.body?.calendar as string) || 'miladi';
  const text: string | undefined = req.body?.summary;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'summary text is required' });
    return;
  }
  const row = (await db.execute({
    sql: 'SELECT summary, expires_at, created_at, summary_lang, summary_calendar FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?',
    args: [userId, lang, calendar],
  })).rows[0] as unknown as { summary: string; expires_at: string; created_at: string; summary_lang: string; summary_calendar: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'No summary found for this language' });
    return;
  }

  // Push old text to history before overwriting
  await db.execute({
    sql: 'INSERT INTO ai_summary_history (user_id, summary, summary_lang, summary_calendar, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [userId, row.summary, row.summary_lang, row.summary_calendar, row.expires_at, row.created_at],
  });
  // Trim history to last 10 per user per lang+calendar
  await db.execute({
    sql: `DELETE FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ? AND id NOT IN (
            SELECT id FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ? ORDER BY created_at DESC LIMIT 10
          )`,
    args: [userId, lang, calendar, userId, lang, calendar],
  });

  const now = new Date().toISOString();
  await db.execute({
    sql: 'UPDATE ai_summaries_lang SET summary = ?, created_at = ? WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?',
    args: [text.trim(), now, userId, lang, calendar],
  });

  res.json({ summary: text.trim(), expires_at: row.expires_at, created_at: now, summary_lang: lang, summary_calendar: calendar });
});

// ---------------------------------------------------------------------------
// Multilingual system prompts
// All prompts share the same structure; each is written in its target language.
// The {SHAMSI_INSTRUCTION} placeholder is replaced at runtime when isShamsi=true.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPTS: Record<string, string> = {
  en: `You are a helpful personal assistant. The user wants to know what needs their attention this week.
Based on the data provided, write a concise, friendly, prioritized summary (3-5 short paragraphs).
Start with the most urgent items. Mention anything overdue or due very soon first.
Be practical and specific. Do not add fluff or generic advice.
The exact dates for today, tomorrow, and day-after-tomorrow are provided in the data — use them directly, do not compute dates yourself.{SHAMSI_INSTRUCTION}
Respond with a JSON object containing exactly two fields:
- "summary": the full summary text (string)
- "expires_at": an ISO 8601 timestamp indicating when this summary should be considered stale. Use your judgment: if items are due today or tomorrow set a shorter expiry (e.g. 6 hours); otherwise expire at end of the current week.
Return only raw JSON, no markdown fences, no extra text.`,

  fa: `شما یک دستیار شخصی مفید هستید. کاربر می‌خواهد بداند این هفته به چه چیزی باید توجه کند.
بر اساس داده‌های ارائه‌شده، یک خلاصه مختصر، دوستانه و اولویت‌بندی‌شده (۳ تا ۵ پاراگراف کوتاه) بنویسید.
با فوری‌ترین موارد شروع کنید. ابتدا موارد عقب‌افتاده یا آنهایی که به زودی سررسید می‌شوند را ذکر کنید.
عملی و دقیق باشید. از توضیحات کلی و بی‌محتوا پرهیز کنید. پاسخ را کاملاً به فارسی بنویسید.
تاریخ‌های امروز، فردا و پس‌فردا در متن داده‌ها به صراحت ذکر شده‌اند — از همان‌ها استفاده کنید و خودتان تاریخ محاسبه نکنید.{SHAMSI_INSTRUCTION}
مبالغ را با واحد ریال بنویسید.
پاسخ را به صورت JSON با دو فیلد برگردانید:
- "summary": متن خلاصه (رشته)
- "expires_at": یک timestamp ISO 8601 که نشان می‌دهد این خلاصه تا چه زمانی معتبر است. اگر آیتم‌های فوری وجود دارد (امروز یا فردا سررسید دارند) مدت اعتبار را کوتاه‌تر (مثلاً ۶ ساعت) تعیین کنید؛ در غیر این صورت تا پایان هفته جاری.
فقط JSON خالص برگردانید، بدون توضیح اضافه.`,

  ar: `أنت مساعد شخصي مفيد. يريد المستخدم معرفة ما يستحق الاهتمام هذا الأسبوع.
استناداً إلى البيانات المقدمة، اكتب ملخصاً موجزاً وودياً ومرتباً حسب الأولوية (3-5 فقرات قصيرة).
ابدأ بالبنود الأكثر إلحاحاً. اذكر أولاً ما فات موعده أو ما يقترب موعده.
كن عملياً ومحدداً. تجنب النصائح العامة والمبهمة. اكتب الإجابة كاملاً باللغة العربية.
التواريخ الدقيقة لليوم وغد وبعد غد مذكورة في البيانات — استخدمها مباشرةً، لا تحسب التواريخ بنفسك.{SHAMSI_INSTRUCTION}
أجب بكائن JSON يحتوي على حقلين بالضبط:
- "summary": نص الملخص الكامل (سلسلة نصية)
- "expires_at": طابع زمني ISO 8601 يشير إلى متى يصبح هذا الملخص قديماً. إذا كانت هناك بنود مستحقة اليوم أو غداً، اجعل مدة الصلاحية أقصر (مثلاً 6 ساعات)؛ وإلا تنتهي في نهاية الأسبوع الحالي.
أعد JSON خاماً فقط، بدون أقواس markdown، بدون نص إضافي.`,

  zh: `你是一位实用的私人助理。用户想知道这周有什么需要关注的事项。
根据提供的数据，写一份简洁、友好、按优先级排列的摘要（3-5个简短段落）。
从最紧急的事项开始，先提及已逾期或即将到期的内容。
要实际具体，避免空洞的建议。请全程用中文书写。
今天、明天和后天的确切日期已在数据中提供——直接使用，不要自行计算日期。{SHAMSI_INSTRUCTION}
请以包含以下两个字段的JSON对象作答：
- "summary": 完整摘要文本（字符串）
- "expires_at": ISO 8601时间戳，表示该摘要何时过期。根据紧急程度判断：如果有今天或明天到期的事项，设置较短的有效期（例如6小时）；否则在本周末过期。
仅返回纯JSON，不要markdown代码块，不要额外文字。`,

  hi: `आप एक सहायक व्यक्तिगत सहायक हैं। उपयोगकर्ता जानना चाहता है कि इस सप्ताह किन बातों पर ध्यान देना है।
दिए गए डेटा के आधार पर एक संक्षिप्त, मित्रवत और प्राथमिकता-क्रमबद्ध सारांश लिखें (3-5 छोटे पैराग्राफ)।
सबसे जरूरी चीजों से शुरू करें। सबसे पहले अतिदेय या जल्द आने वाली चीजें बताएं।
व्यावहारिक और स्पष्ट रहें। अस्पष्ट सामान्य सलाह से बचें। उत्तर पूरी तरह हिंदी में लिखें।
आज, कल और परसों की सटीक तारीखें डेटा में दी गई हैं — उन्हें सीधे उपयोग करें, खुद तारीखें न निकालें।{SHAMSI_INSTRUCTION}
उत्तर में ठीक दो फ़ील्ड वाला JSON ऑब्जेक्ट दें:
- "summary": पूरा सारांश टेक्स्ट (स्ट्रिंग)
- "expires_at": ISO 8601 टाइमस्टैम्प जो बताए कि यह सारांश कब पुराना हो जाएगा। यदि आज या कल तक की कोई समय-सीमा है तो कम समय (जैसे 6 घंटे) रखें; अन्यथा इस सप्ताह के अंत तक।
केवल शुद्ध JSON लौटाएं, कोई markdown fence नहीं, कोई अतिरिक्त टेक्स्ट नहीं।`,

  es: `Eres un asistente personal útil. El usuario quiere saber qué necesita su atención esta semana.
Basándote en los datos proporcionados, escribe un resumen conciso, amigable y priorizado (3-5 párrafos cortos).
Empieza con los elementos más urgentes. Menciona primero lo que está vencido o vence pronto.
Sé práctico y específico. No añadas consejos genéricos ni relleno. Escribe la respuesta completamente en español.
Las fechas exactas de hoy, mañana y pasado mañana están en los datos — úsalas directamente, no calcules fechas tú mismo.{SHAMSI_INSTRUCTION}
Responde con un objeto JSON con exactamente dos campos:
- "summary": el texto completo del resumen (cadena)
- "expires_at": marca de tiempo ISO 8601 que indica cuándo debe considerarse obsoleto este resumen. Si hay elementos con vencimiento hoy o mañana, establece una caducidad más corta (p. ej. 6 horas); de lo contrario, al final de la semana.
Devuelve solo JSON puro, sin comillas de markdown, sin texto adicional.`,

  fr: `Vous êtes un assistant personnel utile. L'utilisateur veut savoir ce qui nécessite son attention cette semaine.
À partir des données fournies, rédigez un résumé concis, convivial et priorisé (3 à 5 courts paragraphes).
Commencez par les éléments les plus urgents. Mentionnez en premier ce qui est en retard ou arrive bientôt à échéance.
Soyez pratique et précis. N'ajoutez pas de conseils généraux ou de remplissage. Rédigez la réponse entièrement en français.
Les dates exactes d'aujourd'hui, demain et après-demain sont dans les données — utilisez-les directement, ne calculez pas les dates vous-même.{SHAMSI_INSTRUCTION}
Répondez avec un objet JSON contenant exactement deux champs :
- "summary" : le texte complet du résumé (chaîne)
- "expires_at" : horodatage ISO 8601 indiquant quand ce résumé doit être considéré comme périmé. Si des éléments arrivent à échéance aujourd'hui ou demain, fixez une expiration plus courte (par ex. 6 heures) ; sinon, à la fin de la semaine.
Renvoyez uniquement du JSON brut, sans balises markdown, sans texte supplémentaire.`,

  de: `Du bist ein hilfreicher persönlicher Assistent. Der Benutzer möchte wissen, worauf er diese Woche achten muss.
Schreibe anhand der bereitgestellten Daten eine prägnante, freundliche und priorisierte Zusammenfassung (3-5 kurze Absätze).
Beginne mit den dringendsten Punkten. Erwähne zuerst, was überfällig ist oder bald fällig wird.
Sei praktisch und konkret. Füge keine allgemeinen Ratschläge oder Fülltext hinzu. Schreibe die Antwort vollständig auf Deutsch.
Die genauen Daten für heute, morgen und übermorgen sind in den Daten angegeben — verwende sie direkt, berechne keine Daten selbst.{SHAMSI_INSTRUCTION}
Antworte mit einem JSON-Objekt mit genau zwei Feldern:
- "summary": der vollständige Zusammenfassungstext (Zeichenkette)
- "expires_at": ISO 8601-Zeitstempel, der angibt, wann diese Zusammenfassung als veraltet gilt. Wenn Elemente heute oder morgen fällig sind, setze eine kürzere Ablaufzeit (z.B. 6 Stunden); ansonsten bis Ende der aktuellen Woche.
Gib nur reines JSON zurück, keine Markdown-Codeblöcke, keinen zusätzlichen Text.`,

  pt: `Você é um assistente pessoal útil. O usuário quer saber o que precisa de atenção esta semana.
Com base nos dados fornecidos, escreva um resumo conciso, amigável e priorizado (3-5 parágrafos curtos).
Comece pelos itens mais urgentes. Mencione primeiro o que está atrasado ou vence em breve.
Seja prático e específico. Não adicione conselhos genéricos ou relleno. Escreva a resposta completamente em português.
As datas exatas de hoje, amanhã e depois de amanhã estão nos dados — use-as diretamente, não calcule datas você mesmo.{SHAMSI_INSTRUCTION}
Responda com um objeto JSON contendo exatamente dois campos:
- "summary": o texto completo do resumo (string)
- "expires_at": timestamp ISO 8601 indicando quando este resumo deve ser considerado desatualizado. Se houver itens com vencimento hoje ou amanhã, defina uma expiração mais curta (ex: 6 horas); caso contrário, ao final da semana.
Retorne apenas JSON puro, sem blocos markdown, sem texto adicional.`,

  ru: `Вы — полезный личный помощник. Пользователь хочет знать, на что обратить внимание на этой неделе.
На основе предоставленных данных напишите краткое, дружелюбное и приоритизированное резюме (3-5 коротких абзаца).
Начните с наиболее срочных пунктов. Сначала упомяните просроченные или скоро наступающие дела.
Будьте практичны и конкретны. Не добавляйте общих советов или воды. Пишите ответ полностью на русском языке.
Точные даты сегодня, завтра и послезавтра указаны в данных — используйте их напрямую, не вычисляйте даты самостоятельно.{SHAMSI_INSTRUCTION}
Ответьте объектом JSON ровно с двумя полями:
- "summary": полный текст резюме (строка)
- "expires_at": временная метка ISO 8601, указывающая, когда это резюме устареет. Если есть дела, срок которых сегодня или завтра, установите более короткое время истечения (например, 6 часов); иначе — до конца текущей недели.
Верните только чистый JSON, без markdown-блоков, без лишнего текста.`,

  tr: `Sen yararlı bir kişisel asistansın. Kullanıcı bu hafta nelere dikkat etmesi gerektiğini öğrenmek istiyor.
Sağlanan verilere dayanarak özlü, samimi ve öncelik sırasına göre düzenlenmiş bir özet yaz (3-5 kısa paragraf).
En acil maddelerle başla. Vadesi geçmiş veya yakında dolacak olanlara önce değin.
Pratik ve özgün ol. Genel tavsiye veya dolgu içerik ekleme. Yanıtı tamamen Türkçe yaz.
Bugün, yarın ve öbür günün tam tarihleri veride belirtilmiştir — bunları doğrudan kullan, tarihleri kendin hesaplama.{SHAMSI_INSTRUCTION}
Tam olarak iki alandan oluşan bir JSON nesnesiyle yanıt ver:
- "summary": tam özet metni (dize)
- "expires_at": bu özetin ne zaman eskiyeceğini gösteren ISO 8601 zaman damgası. Bugün veya yarın vadesi dolan maddeler varsa daha kısa bir süre belirle (örn. 6 saat); aksi takdirde mevcut haftanın sonuna kadar.
Yalnızca ham JSON döndür, markdown blokları veya ekstra metin olmadan.`,

  id: `Anda adalah asisten pribadi yang membantu. Pengguna ingin tahu apa yang perlu diperhatikan minggu ini.
Berdasarkan data yang diberikan, tulis ringkasan yang singkat, ramah, dan diprioritaskan (3-5 paragraf pendek).
Mulai dengan item yang paling mendesak. Sebutkan terlebih dahulu hal-hal yang sudah jatuh tempo atau akan segera jatuh tempo.
Jadilah praktis dan spesifik. Jangan tambahkan saran umum atau pengisi. Tulis jawaban sepenuhnya dalam Bahasa Indonesia.
Tanggal pasti hari ini, besok, dan lusa tersedia dalam data — gunakan langsung, jangan hitung tanggal sendiri.{SHAMSI_INSTRUCTION}
Balas dengan objek JSON yang berisi tepat dua bidang:
- "summary": teks ringkasan lengkap (string)
- "expires_at": stempel waktu ISO 8601 yang menunjukkan kapan ringkasan ini harus dianggap usang. Jika ada item yang jatuh tempo hari ini atau besok, tetapkan kedaluwarsa lebih singkat (misalnya 6 jam); jika tidak, hingga akhir minggu ini.
Kembalikan hanya JSON mentah, tanpa blok markdown, tanpa teks tambahan.`,
};

// ---------------------------------------------------------------------------
// Calendar context lines — inserted at the top of the user prompt
// ---------------------------------------------------------------------------
const CALENDAR_NAMES: Record<string, string> = {
  miladi:    'Miladi (Gregorian)',
  shamsi:    'Shamsi (Jalali/Persian)',
  qamari:    'Qamari (Hijri/Islamic)',
  hebrew:    'Hebrew (Jewish lunisolar)',
  chinese:   'Chinese (lunisolar)',
  saka:      'Indian Saka',
  ethiopian: 'Ethiopian (Ge\'ez)',
};

// POST /api/ai/summary
router.post('/summary', async (req, res) => {
  try {
  const userId = req.user!.id;
  const language: string = req.body?.language ?? 'en';
  const calendar: string = req.body?.calendar ?? 'miladi';
  const isFarsi = language === 'fa';
  const isArabic = language === 'ar';
  const isShamsi = calendar === 'shamsi';

  // Date formatting helpers scoped to the chosen calendar
  const fmtDate = (dateStr: string) =>
    isShamsi ? formatJalali(dateStr) : dateStr;
  const fmtDateTime = (isoStr: string) =>
    isShamsi ? formatJalaliDateTime(isoStr) : isoStr;

  // Currency label
  const currencyLabel = isFarsi ? 'ریال' : 'IRR';

  const todayOverride: string | undefined = req.body?.today;

  // Fetch user's country from preferences (for holiday context)
  const prefsRow = (await db.execute({
    sql: 'SELECT country FROM user_preferences WHERE user_id = ?',
    args: [userId],
  })).rows[0] as unknown as { country: string | null } | undefined;
  const country = prefsRow?.country ?? null;

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
    upcomingHolidays,
  } = await gatherUserData(userId, calendar, todayOverride, country);

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

  // Calendar context line
  const calName = CALENDAR_NAMES[calendar] ?? calendar;
  const weekBounds = isShamsi ? 'Sat–Fri' : 'Mon–Sun';
  const calendarContextLine = `Calendar system: ${calName} | Week: ${weekBounds}`;

  // Build prompt
  const lines: string[] = [
    calendarContextLine,
    `Today is ${todayLabel}.`,
    isFarsi
      ? `تاریخ امروز: ${todayDateLabel} | فردا: ${tomorrowLabel} | پس‌فردا: ${dayAfterLabel}`
      : isArabic
        ? `تاريخ اليوم: ${todayDateLabel} | غداً: ${tomorrowLabel} | بعد غد: ${dayAfterLabel}`
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

  lines.push('', '=== UPCOMING PUBLIC HOLIDAYS (next 14 days) ===');
  if (upcomingHolidays.length === 0) {
    lines.push('No public holidays in the next 14 days.');
  } else {
    upcomingHolidays.forEach(h => {
      const name = isFarsi ? (h.name_fa ?? h.name) : h.name;
      lines.push(`- ${fmtDate(h.date)}: ${name}`);
    });
  }

  const prompt = lines.join('\n');

  // Build system prompt: look up by language, fall back to English, then inject Shamsi instruction
  const shamsiInstruction = isShamsi
    ? (isFarsi
        ? '\nتمام تاریخ‌ها در داده‌ها به تقویم شمسی هستند — همان‌ها را عیناً در خروجی استفاده کنید. هرگز تاریخ میلادی یا عدد ماه ذکر نکنید.'
        : isArabic
          ? '\nجميع التواريخ في البيانات بالتقويم الشمسي (الجلالي) — انسخها كما هي في الإخراج. لا تذكر أبداً تواريخ ميلادية أو أرقام أشهر.'
          : '\nAll dates in the data are already in the Shamsi (Jalali) calendar — copy them verbatim. Never mention Gregorian dates or numeric month numbers.')
    : '';

  const basePrompt = SYSTEM_PROMPTS[language] ?? SYSTEM_PROMPTS['en'];
  const systemPrompt = basePrompt.replace('{SHAMSI_INSTRUCTION}', shamsiInstruction);

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GROQ_API_KEY is not configured in .env' });
      return;
    }
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
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

    // Push existing summary for this lang+calendar to history before overwriting
    const existingRow = (await db.execute({
      sql: 'SELECT summary, expires_at, created_at FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?',
      args: [userId, language, calendar],
    })).rows[0] as unknown as { summary: string; expires_at: string; created_at: string } | undefined;

    if (existingRow) {
      await db.execute({
        sql: 'INSERT INTO ai_summary_history (user_id, summary, summary_lang, summary_calendar, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [userId, existingRow.summary, language, calendar, existingRow.expires_at, existingRow.created_at],
      });
      // Keep only last 10 history entries per user per lang+calendar
      await db.execute({
        sql: `DELETE FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ? AND id NOT IN (
                SELECT id FROM ai_summary_history WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ? ORDER BY created_at DESC LIMIT 10
              )`,
        args: [userId, language, calendar, userId, language, calendar],
      });
    }

    // Delete existing row then insert — avoids ON CONFLICT ambiguity between the old
    // UNIQUE(user_id, summary_lang) table constraint and the new 3-column index.
    await db.execute({
      sql: 'DELETE FROM ai_summaries_lang WHERE user_id = ? AND summary_lang = ? AND summary_calendar = ?',
      args: [userId, language, calendar],
    });
    await db.execute({
      sql: `INSERT INTO ai_summaries_lang (user_id, summary_lang, summary_calendar, summary, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [userId, language, calendar, summary, expiresAtFinal, createdAt],
    });

    res.json({ summary, expires_at: expiresAtFinal, created_at: createdAt, summary_lang: language, summary_calendar: calendar });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Groq error:', message);
    res.status(502).json({ error: `Groq error: ${message}` });
  }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[summary] unhandled error:', message);
    if (!res.headersSent) res.status(500).json({ error: message });
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
      model: 'qwen/qwen3.8-27b',
      messages: [
        { role: 'system', content: habitSystemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400,
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
