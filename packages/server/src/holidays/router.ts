import { Router } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();
router.use(authenticateToken);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Holiday {
  date: string;       // YYYY-MM-DD (Gregorian)
  localName: string;
  name: string;       // English name
  nameFa: string;     // Persian name (localName for IR; translated for others)
  types: string[];
  hidden: boolean;    // user hid this holiday
  isCustom: boolean;  // user added this holiday (not from API)
}

interface UserHolidayRow {
  id: number;
  user_id: number;
  country: string;
  year: number;
  date: string;
  local_name: string;
  name: string;
  name_fa: string | null;
  hidden: number;
  is_custom: number;
}

interface UserWeekendRow {
  id: number;
  user_id: number;
  country: string;
  weekend_days: string; // JSON array of day indices
}

// ---------------------------------------------------------------------------
// CLDR-sourced weekend day indices per country (fallback / initial defaults)
// Date.getDay(): 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
// ---------------------------------------------------------------------------
const CLDR_WEEKEND_MAP: Record<string, number[]> = {
  AF: [5, 6], DZ: [5, 6], BH: [5, 6], BD: [5, 6], EG: [5, 6],
  IR: [5, 6], IQ: [5, 6], IL: [5, 6], JO: [5, 6], KW: [5, 6],
  LY: [5, 6], MV: [5, 6], MR: [5, 6], OM: [5, 6], PS: [5, 6],
  QA: [5, 6], SA: [5, 6], SD: [5, 6], SY: [5, 6], AE: [5, 6],
  YE: [5, 6], MA: [5, 6],
  US: [0, 6], CA: [0, 6], GB: [0, 6], AU: [0, 6], NZ: [0, 6],
  DE: [0, 6], FR: [0, 6], IT: [0, 6], ES: [0, 6], NL: [0, 6],
  BE: [0, 6], AT: [0, 6], CH: [0, 6], SE: [0, 6], NO: [0, 6],
  DK: [0, 6], FI: [0, 6], PL: [0, 6], CZ: [0, 6], HU: [0, 6],
  RO: [0, 6], GR: [0, 6], PT: [0, 6], UA: [0, 6], RU: [0, 6],
  BR: [0, 6], MX: [0, 6], AR: [0, 6], CL: [0, 6], CO: [0, 6],
  PE: [0, 6], JP: [0, 6], KR: [0, 6], CN: [0, 6], TW: [0, 6],
  IN: [0, 6], PK: [0, 6], ID: [0, 6], PH: [0, 6], TH: [0, 6],
  VN: [0, 6], MY: [0, 6], SG: [0, 6], TR: [0, 6], NG: [0, 6],
  ZA: [0, 6], KZ: [0, 6], UZ: [0, 6], RS: [0, 6], HR: [0, 6],
  IE: [0, 6],
};

// ---------------------------------------------------------------------------
// External API helpers
// ---------------------------------------------------------------------------

interface CalendarificHoliday {
  name: string;
  date: { iso: string };
  type: string[];
}
interface CalendarificResponse {
  meta: { code: number };
  response: { holidays: CalendarificHoliday[] };
}
interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  types: string[];
}

// ---------------------------------------------------------------------------
// Static Persian holiday name translations
// Key format: "CC:English Name" (case-sensitive match on the API's English name).
// IR entries are explicit because Calendarific returns English names for Iran too.
// ---------------------------------------------------------------------------
const PERSIAN_NAMES: Record<string, string> = {
  // --- Iran (IR) — Calendarific returns English names; we supply Persian ---
  'IR:Nowruz':                                   'نوروز',
  'IR:Nowruz Holiday':                           'تعطیلات نوروز',
  'IR:Islamic Republic Day':                     'روز جمهوری اسلامی',
  'IR:Sizdah Be-dar':                            'سیزده‌بدر',
  'IR:Death of Imam Khomeini':                   'رحلت حضرت امام خمینی',
  'IR:Khordad National Uprising':                'قیام ۱۵ خرداد',
  'IR:Islamic Revolution Day':                   'پیروزی انقلاب اسلامی',
  'IR:Oil Nationalization Day':                  'روز ملی شدن صنعت نفت',
  'IR:Prophet Muhammad\'s Birthday':             'میلاد حضرت محمد (ص)',
  'IR:Prophet\'s Birthday':                      'میلاد حضرت محمد (ص)',
  'IR:Prophet Muhammad\'s Birthday and Imam Sadegh\'s Birthday': 'میلاد پیامبر (ص) و امام صادق (ع)',
  'IR:Imam Ali\'s Birthday':                     'میلاد حضرت علی (ع)',
  'IR:Imam Ali Birthday':                        'میلاد حضرت علی (ع)',
  'IR:Start of Ramadan':                         'آغاز ماه رمضان',
  'IR:Eid al-Fitr':                              'عید فطر',
  'IR:Eid al-Fitr Holiday':                      'تعطیلات عید فطر',
  'IR:Eid al-Adha':                              'عید قربان',
  'IR:Eid al-Ghadir':                            'عید غدیر خم',
  'IR:Tasua':                                    'تاسوعای حسینی',
  'IR:Ashura':                                   'عاشورای حسینی',
  'IR:Arbaeen':                                  'اربعین حسینی',
  'IR:Death of Prophet Muhammad':                'رحلت حضرت محمد (ص)',
  'IR:Death of Prophet Muhammad and Imam Hasan Martyrdom': 'رحلت پیامبر (ص) و شهادت امام حسن (ع)',
  'IR:Imam Hassan\'s Martyrdom':                 'شهادت امام حسن (ع)',
  'IR:Imam Reza\'s Martyrdom':                   'شهادت امام رضا (ع)',
  'IR:Imam Reza Martyrdom':                      'شهادت امام رضا (ع)',
  'IR:Islamic New Year':                         'اول محرم',
  'IR:Prophet\'s Mission Day':                   'مبعث حضرت رسول (ص)',
  'IR:Imam Mahdi\'s Birthday':                   'میلاد حضرت مهدی (عج)',
  'IR:Imam Mahdi Birthday':                      'میلاد حضرت مهدی (عج)',
  'IR:Fatima\'s Birthday':                       'میلاد حضرت فاطمه (س)',
  'IR:Imam Khomeini\'s Death Anniversary':       'رحلت امام خمینی',
  'IR:Martyrdom of Imam Ali':                    'شهادت حضرت علی (ع)',
  'IR:Martyrdom of Imam Ali ibn Abi Talib':      'شهادت حضرت علی (ع)',
  // --- United States ---
  'US:New Year\'s Day':                     'روز سال نو',
  'US:Martin Luther King Jr. Day':          'روز مارتین لوتر کینگ',
  'US:Washington\'s Birthday':              'روز تولد واشنگتن',
  'US:Memorial Day':                        'روز یادبود',
  'US:Juneteenth National Independence Day':'روز استقلال جونتینت',
  'US:Independence Day':                    'روز استقلال',
  'US:Labor Day':                           'روز کار',
  'US:Columbus Day':                        'روز کلمب',
  'US:Veterans Day':                        'روز جانبازان',
  'US:Thanksgiving Day':                    'روز شکرگزاری',
  'US:Christmas Day':                       'روز کریسمس',
  // --- United Kingdom ---
  'GB:New Year\'s Day':                     'روز سال نو',
  'GB:Good Friday':                         'جمعه مقدس',
  'GB:Easter Monday':                       'دوشنبه عید پاک',
  'GB:Early May Bank Holiday':              'تعطیلات اوایل ماه مه',
  'GB:Spring Bank Holiday':                 'تعطیلات بهاره',
  'GB:Summer Bank Holiday':                 'تعطیلات تابستانه',
  'GB:Christmas Day':                       'روز کریسمس',
  'GB:Boxing Day':                          'روز باکسینگ',
  // --- Germany ---
  'DE:New Year\'s Day':                     'روز سال نو',
  'DE:Good Friday':                         'جمعه مقدس',
  'DE:Easter Monday':                       'دوشنبه عید پاک',
  'DE:Labour Day':                          'روز کار',
  'DE:Ascension Day':                       'عروج حضرت مسیح',
  'DE:Whit Monday':                         'دوشنبه پنطیکاست',
  'DE:German Unity Day':                    'روز وحدت آلمان',
  'DE:Christmas Day':                       'روز کریسمس',
  'DE:Second Day of Christmas':             'روز دوم کریسمس',
  // --- France ---
  'FR:New Year\'s Day':                     'روز سال نو',
  'FR:Easter Monday':                       'دوشنبه عید پاک',
  'FR:Labour Day':                          'روز کار',
  'FR:Victory in Europe Day':               'روز پیروزی در اروپا',
  'FR:Ascension Day':                       'عروج حضرت مسیح',
  'FR:Whit Monday':                         'دوشنبه پنطیکاست',
  'FR:Bastille Day':                        'روز باستیل',
  'FR:Assumption of Mary':                  'عروج مریم مقدس',
  'FR:All Saints\' Day':                    'روز همه قدیسان',
  'FR:Armistice Day':                       'روز آتش‌بس',
  'FR:Christmas Day':                       'روز کریسمس',
  // --- Turkey ---
  'TR:New Year\'s Day':                     'روز سال نو',
  'TR:National Sovereignty and Children\'s Day': 'روز حاکمیت ملی و کودک',
  'TR:Labour and Solidarity Day':           'روز کار و همبستگی',
  'TR:Commemoration of Atatürk':            'یادبود آتاتورک',
  'TR:Victory Day':                         'روز پیروزی',
  'TR:Republic Day':                        'روز جمهوری',
  'TR:Eid al-Fitr':                         'عید فطر',
  'TR:Eid al-Fitr Holiday':                 'تعطیلات عید فطر',
  'TR:Eid al-Adha':                         'عید قربان',
  'TR:Eid al-Adha Holiday':                 'تعطیلات عید قربان',
  // --- Saudi Arabia ---
  'SA:National Day':                        'روز ملی عربستان',
  'SA:Founding Day':                        'روز تأسیس',
  'SA:Eid al-Fitr':                         'عید فطر',
  'SA:Eid al-Fitr Holiday':                 'تعطیلات عید فطر',
  'SA:Eid al-Adha':                         'عید قربان',
  'SA:Eid al-Adha Holiday':                 'تعطیلات عید قربان',
  // --- United Arab Emirates ---
  'AE:New Year\'s Day':                     'روز سال نو',
  'AE:Commemoration Day':                   'روز شهدا',
  'AE:National Day':                        'روز ملی امارات',
  'AE:Eid al-Fitr':                         'عید فطر',
  'AE:Eid al-Fitr Holiday':                 'تعطیلات عید فطر',
  'AE:Eid al-Adha':                         'عید قربان',
  'AE:Eid al-Adha Holiday':                 'تعطیلات عید قربان',
  'AE:Islamic New Year':                    'سال نو اسلامی',
  'AE:Prophet\'s Birthday':                 'میلاد پیامبر',
  // --- Iraq ---
  'IQ:New Year\'s Day':                     'روز سال نو',
  'IQ:Army Day':                            'روز ارتش',
  'IQ:Liberation Day':                      'روز آزادسازی',
  'IQ:Eid al-Fitr':                         'عید فطر',
  'IQ:Eid al-Adha':                         'عید قربان',
  'IQ:Islamic New Year':                    'سال نو اسلامی',
  'IQ:Ashura':                              'عاشورا',
  'IQ:Prophet\'s Birthday':                 'میلاد پیامبر',
  'IQ:National Day':                        'روز ملی',
  'IQ:Republic Day':                        'روز جمهوری',
  // --- Afghanistan ---
  'AF:New Year\'s Day':                     'روز سال نو',
  'AF:Nowruz':                              'نوروز',
  'AF:Eid al-Fitr':                         'عید فطر',
  'AF:Eid al-Adha':                         'عید قربان',
  'AF:Islamic New Year':                    'سال نو اسلامی',
  'AF:Ashura':                              'عاشورا',
  'AF:Prophet\'s Birthday':                 'میلاد پیامبر',
  'AF:Independence Day':                    'روز استقلال',
  // --- Pakistan ---
  'PK:New Year\'s Day':                     'روز سال نو',
  'PK:Kashmir Day':                         'روز کشمیر',
  'PK:Pakistan Day':                        'روز پاکستان',
  'PK:Labour Day':                          'روز کار',
  'PK:Independence Day':                    'روز استقلال',
  'PK:Defence Day':                         'روز دفاع',
  'PK:Eid-e-Milad':                         'میلاد پیامبر',
  'PK:Eid al-Fitr':                         'عید فطر',
  'PK:Eid al-Adha':                         'عید قربان',
  'PK:Ashura':                              'عاشورا',
  // --- India ---
  'IN:Republic Day':                        'روز جمهوری',
  'IN:Independence Day':                    'روز استقلال',
  'IN:Gandhi Jayanti':                      'سالروز تولد گاندی',
  // --- China ---
  'CN:New Year\'s Day':                     'روز سال نو',
  'CN:Chinese New Year':                    'سال نو چینی',
  'CN:Tomb Sweeping Day':                   'روز پاکسازی مزار',
  'CN:Labour Day':                          'روز کار',
  'CN:Dragon Boat Festival':                'جشن قایق اژدها',
  'CN:Mid-Autumn Festival':                 'جشن نیمه پاییز',
  'CN:National Day':                        'روز ملی',
  // --- Japan ---
  'JP:New Year\'s Day':                     'روز سال نو',
  'JP:Coming of Age Day':                   'روز بلوغ',
  'JP:National Foundation Day':             'روز بنیانگذاری',
  'JP:Vernal Equinox Day':                  'روز اعتدال بهاری',
  'JP:Showa Day':                           'روز شووا',
  'JP:Constitution Day':                    'روز قانون اساسی',
  'JP:Greenery Day':                        'روز طبیعت',
  'JP:Children\'s Day':                     'روز کودک',
  'JP:Marine Day':                          'روز دریا',
  'JP:Mountain Day':                        'روز کوه',
  'JP:Respect for the Aged Day':            'روز احترام به سالمندان',
  'JP:Sports Day':                          'روز ورزش',
  'JP:Culture Day':                         'روز فرهنگ',
  'JP:Labour Thanksgiving Day':             'روز شکرگزاری کار',
  'JP:Emperor\'s Birthday':                 'روز تولد امپراتور',
  // --- Russia ---
  'RU:New Year\'s Day':                     'روز سال نو',
  'RU:Christmas Day':                       'روز کریسمس',
  'RU:Defender of the Fatherland Day':      'روز مدافع وطن',
  'RU:International Women\'s Day':          'روز جهانی زن',
  'RU:Spring and Labour Day':               'روز بهار و کار',
  'RU:Victory Day':                         'روز پیروزی',
  'RU:Russia Day':                          'روز روسیه',
  'RU:National Unity Day':                  'روز وحدت ملی',
  // --- Brazil ---
  'BR:New Year\'s Day':                     'روز سال نو',
  'BR:Carnival':                            'کارناوال',
  'BR:Good Friday':                         'جمعه مقدس',
  'BR:Tiradentes\' Day':                    'روز تیرادنتس',
  'BR:Labour Day':                          'روز کار',
  'BR:Corpus Christi':                      'جشن کورپوس کریستی',
  'BR:Independence Day':                    'روز استقلال',
  'BR:Our Lady of Aparecida':               'روز بانوی آپاریسیدا',
  'BR:All Souls\' Day':                     'روز تمام ارواح',
  'BR:Republic Day':                        'روز جمهوری',
  'BR:Christmas Day':                       'روز کریسمس',
  // --- Common Islamic holidays (any country) ---
  'Eid al-Fitr':         'عید فطر',
  'Eid al-Adha':         'عید قربان',
  'Islamic New Year':    'سال نو اسلامی',
  'Ashura':              'عاشورا',
  'Prophet\'s Birthday': 'میلاد پیامبر',
  'Nowruz':              'نوروز',
  // --- Common worldwide ---
  'New Year\'s Day':     'روز سال نو',
  'Christmas Day':       'روز کریسمس',
  'Labour Day':          'روز کار',
  'Independence Day':    'روز استقلال',
  'National Day':        'روز ملی',
  'Good Friday':         'جمعه مقدس',
  'Easter Monday':       'دوشنبه عید پاک',
};

/**
 * Returns true if the string contains at least one non-Latin / non-ASCII letter
 * (Arabic, Persian, Cyrillic, CJK, Devanagari, etc.).  Used to detect when an
 * API already returned a localised name so we can prefer it over a static map.
 */
function isNonLatin(s: string): boolean {
  return /[^\u0000-\u007F\s\d.,!?;:'"()\-]/.test(s);
}

/**
 * Resolve the Persian name for a holiday.
 * Priority:
 * 1. PERSIAN_NAMES["CC:EnglishName"]  — explicit country-specific translation
 * 2. PERSIAN_NAMES["EnglishName"]     — common Islamic / worldwide key
 * 3. localName from the API           — Nager.Date already returns the native script
 *    (Persian for IR, Arabic for SA/AE, Hebrew for IL, etc.)
 * 4. English name                     — last resort
 */
function resolveNameFa(country: string, apiLocalName: string, apiEnglishName: string): string {
  return (
    PERSIAN_NAMES[`${country}:${apiEnglishName}`] ??
    PERSIAN_NAMES[apiEnglishName] ??
    (isNonLatin(apiLocalName) ? apiLocalName : undefined) ??
    apiEnglishName
  );
}

async function fetchCalendarific(country: string, year: number): Promise<Holiday[]> {
  const apiKey = process.env.CALENDARIFIC_API_KEY;
  if (!apiKey) throw new Error('CALENDARIFIC_API_KEY not set');
  const res = await fetch(
    `https://calendarific.com/api/v2/holidays?api_key=${apiKey}&country=${country}&year=${year}&type=national`,
  );
  if (!res.ok) throw new Error(`Calendarific HTTP ${res.status}`);
  const body = await res.json() as CalendarificResponse;
  if (body.meta.code !== 200) throw new Error(`Calendarific API error ${body.meta.code}`);
  return body.response.holidays
    .filter(h => h.type.some(t => /national|public|official/i.test(t)))
    .map(h => ({
      date: h.date.iso.slice(0, 10),
      localName: h.name,
      name: h.name,
      nameFa: resolveNameFa(country, h.name, h.name),
      types: h.type,
      hidden: false,
      isCustom: false,
    }));
}

async function fetchNager(country: string, year: number): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
  if (!res.ok) return [];
  const body = await res.json() as NagerHoliday[];
  return body.map(h => ({
    date: h.date,
    localName: h.localName,
    name: h.name,
    nameFa: resolveNameFa(country, h.localName, h.name),
    types: h.types,
    hidden: false,
    isCustom: false,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/holidays?country=IR&year=2025
// Returns merged: API holidays + user overrides/additions, honouring hidden flags.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const { country, year: yearStr } = req.query as { country?: string; year?: string };
  const userId = req.user!.id;

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country must be a 2-letter uppercase ISO code' });
    return;
  }
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (isNaN(year) || year < 1900 || year > 2100) {
    res.status(400).json({ error: 'year must be a valid 4-digit number' });
    return;
  }

  // Load user overrides for the requested year
  const overrideRows = (await db.execute({
    sql: 'SELECT * FROM user_holidays WHERE user_id = ? AND country = ? AND year = ?',
    args: [userId, country, year],
  })).rows as unknown as UserHolidayRow[];

  const overrideByDate = new Map<string, UserHolidayRow>();
  for (const row of overrideRows) overrideByDate.set(row.date, row);

  // Build a translation memory: name (English) → name_fa learned from ALL user
  // overrides for this country across any year.  This lets corrections made in one
  // year automatically propagate to other years without the user having to re-edit.
  const learnedRows = (await db.execute({
    sql: `SELECT DISTINCT name, name_fa FROM user_holidays
          WHERE user_id = ? AND country = ? AND name_fa IS NOT NULL AND name_fa != ''`,
    args: [userId, country],
  })).rows as unknown as { name: string; name_fa: string }[];

  // Use a Map so the most-recently-updated entry wins when the same English name
  // appears in multiple rows (shouldn't normally happen, but guard for it).
  const learnedNameFa = new Map<string, string>();
  for (const row of learnedRows) {
    if (row.name_fa) learnedNameFa.set(row.name, row.name_fa);
  }

  // Fetch API holidays (unless all dates are covered by custom entries only)
  let apiHolidays: Holiday[] = [];
  try {
    apiHolidays = await fetchCalendarific(country, year);
  } catch {
    try {
      apiHolidays = await fetchNager(country, year);
    } catch {
      apiHolidays = [];
    }
  }

  // Deduplicate API results by date
  const seen = new Set<string>();
  const deduped = apiHolidays.filter(h => {
    if (seen.has(h.date)) return false;
    seen.add(h.date);
    return true;
  });

  /**
   * Resolve nameFa for an API holiday, incorporating the user's translation memory.
   * Priority:
   *   1. Static PERSIAN_NAMES map (country-specific or generic)
   *   2. Non-Latin localName returned by the API (e.g. Nager.Date Persian)
   *   3. User's learned translation for this English name (from other years)
   *   4. English name fallback
   */
  function resolveWithMemory(englishName: string, localName: string): string {
    return (
      PERSIAN_NAMES[`${country}:${englishName}`] ??
      PERSIAN_NAMES[englishName] ??
      (isNonLatin(localName) ? localName : undefined) ??
      learnedNameFa.get(englishName) ??
      englishName
    );
  }

  // Merge: API holidays patched with user overrides
  const merged = new Map<string, Holiday>();
  for (const h of deduped) {
    const ov = overrideByDate.get(h.date);
    if (ov) {
      // User has an override for this date — use its stored name_fa; fall back to
      // the memory-aware resolver so edits in other years are still applied.
      merged.set(h.date, {
        date: h.date,
        localName: ov.local_name,
        name: ov.name,
        nameFa: ov.name_fa ?? resolveWithMemory(ov.name, ov.local_name),
        types: h.types,
        hidden: ov.hidden === 1,
        isCustom: false,
      });
    } else {
      // No override — use memory-aware resolver so learned translations apply
      merged.set(h.date, {
        ...h,
        nameFa: resolveWithMemory(h.name, h.localName),
      });
    }
  }

  // Add custom user-created holidays not in the API
  for (const row of overrideRows) {
    if (row.is_custom === 1 && !merged.has(row.date)) {
      merged.set(row.date, {
        date: row.date,
        localName: row.local_name,
        name: row.name,
        nameFa: row.name_fa ?? row.local_name,
        types: ['Custom'],
        hidden: row.hidden === 1,
        isCustom: true,
      });
    }
  }

  const result = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/holidays/weekends?country=IR
// IMPORTANT: must be registered BEFORE /:date to avoid Express matching
//            "weekends" as the :date parameter.
// Returns user-customised weekend days, or CLDR default if no override.
// ---------------------------------------------------------------------------
router.get('/weekends', async (req, res) => {
  const { country } = req.query as { country?: string };
  const userId = req.user!.id;

  if (!country) {
    res.json({ weekendDays: [0, 6] });
    return;
  }
  if (!/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country must be a 2-letter uppercase ISO code' });
    return;
  }

  const row = (await db.execute({
    sql: 'SELECT * FROM user_weekends WHERE user_id = ? AND country = ?',
    args: [userId, country],
  })).rows[0] as unknown as UserWeekendRow | undefined;

  if (row) {
    const weekendDays: number[] = JSON.parse(row.weekend_days);
    res.json({ country, weekendDays, isCustom: true });
  } else {
    const weekendDays = CLDR_WEEKEND_MAP[country] ?? [0, 6];
    res.json({ country, weekendDays, isCustom: false });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/holidays/weekends  — save user weekend preference
// IMPORTANT: must be before PUT /:date
// Body: { country, weekendDays: number[] }
// ---------------------------------------------------------------------------
router.put('/weekends', async (req, res) => {
  const userId = req.user!.id;
  const { country, weekendDays } = req.body as { country: string; weekendDays: number[] };

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country is required' });
    return;
  }
  if (!Array.isArray(weekendDays) || weekendDays.some(d => typeof d !== 'number' || d < 0 || d > 6)) {
    res.status(400).json({ error: 'weekendDays must be an array of day indices 0–6' });
    return;
  }

  await db.execute({
    sql: `INSERT INTO user_weekends (user_id, country, weekend_days, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, country)
          DO UPDATE SET
            weekend_days = excluded.weekend_days,
            updated_at   = datetime('now')`,
    args: [userId, country, JSON.stringify(weekendDays)],
  });

  res.json({ country, weekendDays });
});

// ---------------------------------------------------------------------------
// DELETE /api/holidays/weekends?country=IR  — reset to CLDR default
// IMPORTANT: must be before DELETE /:date
// ---------------------------------------------------------------------------
router.delete('/weekends', async (req, res) => {
  const userId = req.user!.id;
  const { country } = req.query as { country?: string };

  if (!country) {
    res.status(400).json({ error: 'country is required' });
    return;
  }

  await db.execute({
    sql: 'DELETE FROM user_weekends WHERE user_id = ? AND country = ?',
    args: [userId, country],
  });

  const weekendDays = CLDR_WEEKEND_MAP[country] ?? [0, 6];
  res.json({ country, weekendDays, isCustom: false });
});

// ---------------------------------------------------------------------------
// PUT /api/holidays/:date  — upsert a holiday override (edit name / toggle hidden)
// Body: { country, year, localName, name, nameFa?, hidden?, isCustom? }
// ---------------------------------------------------------------------------
router.put('/:date', async (req, res) => {
  const userId = req.user!.id;
  const { date } = req.params as { date: string };
  const { country, year, localName, name, nameFa, hidden = false, isCustom = false } =
    req.body as {
      country: string;
      year: number;
      localName: string;
      name: string;
      nameFa?: string;
      hidden?: boolean;
      isCustom?: boolean;
    };

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    res.status(400).json({ error: 'country is required' });
    return;
  }
  if (!year || isNaN(year)) {
    res.status(400).json({ error: 'year is required' });
    return;
  }
  if (!localName?.trim() || !name?.trim()) {
    res.status(400).json({ error: 'localName and name are required' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }

  // Resolve nameFa: use the client-supplied value if present, otherwise compute it
  const resolvedNameFa = nameFa?.trim() || resolveNameFa(country, localName.trim(), name.trim());

  await db.execute({
    sql: `INSERT INTO user_holidays (user_id, country, year, date, local_name, name, name_fa, hidden, is_custom, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, country, year, date)
          DO UPDATE SET
            local_name = excluded.local_name,
            name       = excluded.name,
            name_fa    = excluded.name_fa,
            hidden     = excluded.hidden,
            is_custom  = excluded.is_custom,
            updated_at = datetime('now')`,
    args: [userId, country, year, date, localName.trim(), name.trim(), resolvedNameFa, hidden ? 1 : 0, isCustom ? 1 : 0],
  });

  res.json({ date, localName: localName.trim(), name: name.trim(), nameFa: resolvedNameFa, hidden, isCustom });
});

// ---------------------------------------------------------------------------
// DELETE /api/holidays/:date?country=IR&year=2025
// Removes the user override for this date entirely (restores API default).
// ---------------------------------------------------------------------------
router.delete('/:date', async (req, res) => {
  const userId = req.user!.id;
  const { date } = req.params as { date: string };
  const { country, year: yearStr } = req.query as { country?: string; year?: string };

  if (!country || !yearStr) {
    res.status(400).json({ error: 'country and year query params are required' });
    return;
  }
  const year = parseInt(yearStr, 10);

  await db.execute({
    sql: 'DELETE FROM user_holidays WHERE user_id = ? AND country = ? AND year = ? AND date = ?',
    args: [userId, country, year, date],
  });

  res.json({ ok: true });
});

export default router;
