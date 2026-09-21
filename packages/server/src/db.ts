import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error('TURSO_DATABASE_URL is not set');

export const db = createClient({ url, authToken });

/** Run each statement individually; swallow errors that just mean "already exists". */
async function runSafe(statements: string[]): Promise<void> {
  for (const sql of statements) {
    try {
      await db.execute(sql);
    } catch (e: any) {
      const msg = String(e).toLowerCase();
      // Idempotent — skip errors that mean the object already exists
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('duplicate column name')
      ) continue;
      // For anything else, log but do NOT crash the server
      console.warn('[migration] skipped statement due to error:', msg.slice(0, 120));
    }
  }
}

export async function runMigrations(): Promise<void> {
  // ── Initial schema ────────────────────────────────────────────────────────
  // Each statement is run individually so Turso's HTTP transport handles them.
  await runSafe([
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      title       TEXT    NOT NULL,
      description TEXT,
      due_date    TEXT,
      priority    TEXT    DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      status      TEXT    DEFAULT 'open'   CHECK(status   IN ('open','done')),
      created_at  TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS bills (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      name       TEXT    NOT NULL,
      amount     REAL,
      due_date   TEXT,
      recurrence TEXT    DEFAULT 'once' CHECK(recurrence IN ('once','monthly','yearly')),
      paid       INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      name              TEXT    NOT NULL,
      amount            REAL,
      billing_cycle     TEXT    CHECK(billing_cycle IN ('weekly','monthly','yearly')),
      next_billing_date TEXT,
      active            INTEGER DEFAULT 1,
      max_repetitions   INTEGER,
      created_at        TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      title      TEXT    NOT NULL,
      remind_at  TEXT    NOT NULL,
      notes      TEXT,
      done       INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS habits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      name        TEXT    NOT NULL,
      frequency   TEXT    DEFAULT 'daily' CHECK(frequency IN ('daily','weekly')),
      target_days TEXT    DEFAULT '[]',
      created_at  TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS habit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id    INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      logged_date TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(habit_id, logged_date)
    )`,
    `CREATE TABLE IF NOT EXISTS important_dates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      title         TEXT    NOT NULL,
      date          TEXT    NOT NULL,
      recurs_yearly INTEGER DEFAULT 0,
      notes         TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      title           TEXT    NOT NULL,
      filename        TEXT    NOT NULL,
      mimetype        TEXT,
      size            INTEGER,
      tags            TEXT    DEFAULT '[]',
      drive_file_id   TEXT,
      drive_view_link TEXT,
      uploaded_at     TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_preferences (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER UNIQUE NOT NULL REFERENCES users(id),
      calendar   TEXT    NOT NULL DEFAULT 'miladi',
      language   TEXT    NOT NULL DEFAULT 'en',
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS google_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token    TEXT    NOT NULL,
      refresh_token   TEXT,
      expiry          TEXT,
      drive_folder_id TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_user_id           ON tasks(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bills_user_id           ON bills(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_user_id       ON reminders(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_habits_user_id          ON habits(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id     ON habit_logs(habit_id)`,
    `CREATE INDEX IF NOT EXISTS idx_important_dates_user_id ON important_dates(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_user_id       ON documents(user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id)`,
    `CREATE TABLE IF NOT EXISTS google_tasks_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token  TEXT    NOT NULL,
      refresh_token TEXT,
      expiry        TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tasks_tokens_user_id ON google_tasks_tokens(user_id)`,
    `CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token  TEXT    NOT NULL,
      refresh_token TEXT,
      expiry        TEXT,
      calendar_id   TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id)`,

    // ── ALTER TABLE / additive migrations ────────────────────────────────────
    `ALTER TABLE documents ADD COLUMN drive_file_id TEXT`,
    `ALTER TABLE documents ADD COLUMN drive_view_link TEXT`,
    `ALTER TABLE tasks ADD COLUMN google_task_id TEXT`,
    `ALTER TABLE reminders ADD COLUMN google_calendar_event_id TEXT`,
    `ALTER TABLE important_dates ADD COLUMN google_calendar_event_id TEXT`,
    `ALTER TABLE tasks ADD COLUMN google_calendar_event_id TEXT`,
    `CREATE TABLE IF NOT EXISTS task_groups (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      name              TEXT    NOT NULL,
      google_list_id    TEXT,
      sort_order        INTEGER DEFAULT 0,
      is_default        INTEGER DEFAULT 0,
      is_google_default INTEGER DEFAULT 0,
      created_at        TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON task_groups(user_id)`,
    `ALTER TABLE tasks ADD COLUMN task_group_id INTEGER REFERENCES task_groups(id) ON DELETE SET NULL`,
    `ALTER TABLE task_groups ADD COLUMN is_default INTEGER DEFAULT 0`,
    `ALTER TABLE task_groups ADD COLUMN is_google_default INTEGER DEFAULT 0`,
    `ALTER TABLE subscriptions ADD COLUMN max_repetitions INTEGER`,
    `ALTER TABLE user_preferences ADD COLUMN language TEXT NOT NULL DEFAULT 'en'`,
    `ALTER TABLE habits ADD COLUMN name_en TEXT`,
    `ALTER TABLE habits ADD COLUMN name_fa TEXT`,
    `CREATE TABLE IF NOT EXISTS ai_summaries (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id),
      summary    TEXT    NOT NULL,
      expires_at TEXT    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS loans (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      name              TEXT    NOT NULL,
      lender            TEXT,
      total_amount      REAL    NOT NULL,
      remaining_amount  REAL    NOT NULL,
      installment       REAL,
      due_day           INTEGER,
      next_payment_date TEXT,
      notes             TEXT,
      active            INTEGER DEFAULT 1,
      created_at        TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id)`,
    `ALTER TABLE user_preferences ADD COLUMN country TEXT DEFAULT NULL`,
    `CREATE TABLE IF NOT EXISTS user_holidays (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      country     TEXT    NOT NULL,
      year        INTEGER NOT NULL,
      date        TEXT    NOT NULL,
      local_name  TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      hidden      INTEGER NOT NULL DEFAULT 0,
      is_custom   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, country, year, date)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_holidays_user ON user_holidays(user_id, country, year)`,
    `CREATE TABLE IF NOT EXISTS user_weekends (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      country      TEXT    NOT NULL,
      weekend_days TEXT    NOT NULL DEFAULT '[]',
      created_at   TEXT    DEFAULT (datetime('now')),
      updated_at   TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, country)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_weekends_user ON user_weekends(user_id, country)`,
    `ALTER TABLE user_holidays ADD COLUMN name_fa TEXT`,
    // ai_summaries_lang: created with the correct 3-column unique constraint from the start.
    // New installs get the right schema; existing installs get the table-rebuild migration below.
    `CREATE TABLE IF NOT EXISTS ai_summaries_lang (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      summary_lang     TEXT    NOT NULL DEFAULT 'en',
      summary_calendar TEXT    NOT NULL DEFAULT 'miladi',
      summary          TEXT    NOT NULL,
      expires_at       TEXT    NOT NULL,
      created_at       TEXT    NOT NULL,
      UNIQUE(user_id, summary_lang, summary_calendar)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_summaries_lang_user ON ai_summaries_lang(user_id, summary_lang)`,
    `CREATE TABLE IF NOT EXISTS ai_summary_history (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL REFERENCES users(id),
      summary          TEXT    NOT NULL,
      summary_lang     TEXT    NOT NULL DEFAULT 'en',
      summary_calendar TEXT    NOT NULL DEFAULT 'miladi',
      expires_at       TEXT    NOT NULL,
      created_at       TEXT    NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_summary_history_user ON ai_summary_history(user_id, summary_lang, created_at)`,
    `ALTER TABLE user_preferences ADD COLUMN secondary_calendar TEXT DEFAULT NULL`,
    `ALTER TABLE user_preferences ADD COLUMN tertiary_calendar TEXT DEFAULT NULL`,
    // These two are no-ops on new installs (columns already in CREATE TABLE above);
    // on old installs they add the column to the existing table.
    `ALTER TABLE ai_summaries_lang ADD COLUMN summary_calendar TEXT NOT NULL DEFAULT 'miladi'`,
    `ALTER TABLE ai_summary_history ADD COLUMN summary_calendar TEXT NOT NULL DEFAULT 'miladi'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_summaries_lang_user_lang_cal ON ai_summaries_lang(user_id, summary_lang, summary_calendar)`,
    `ALTER TABLE users ADD COLUMN password_hash TEXT`,
    // Per-language + per-calendar AI summary history index
    `CREATE INDEX IF NOT EXISTS idx_ai_summary_history_user_lang ON ai_summary_history(user_id, summary_lang, summary_calendar, created_at)`,
  ]);

  // ── Table-rebuild migration: drop old 2-column UNIQUE constraint ──────────
  // On existing DBs, ai_summaries_lang was created with UNIQUE(user_id, summary_lang).
  // That blocks storing two calendars for the same user+lang. We rebuild the table
  // with the correct 3-column constraint using individual execute() calls only.
  // Detection: the old table has no summary_calendar column at all.
  try {
    // Check if the summary_calendar column exists via PRAGMA — works on Turso
    const colRows = (await db.execute({
      sql: `PRAGMA table_info(ai_summaries_lang)`,
      args: [],
    })).rows as unknown as { name: string }[];

    const hasSummaryCalendar = colRows.some(r => r.name === 'summary_calendar');

    // If the column is missing entirely, the table is the old schema — rebuild it.
    // If the column exists but the unique index is still 2-column, the old index
    // was added via ALTER TABLE (no enforcement at write time by SQLite for partial
    // constraint), so just attempt the rebuild whenever summary_calendar is missing.
    if (!hasSummaryCalendar) {
      console.log('[migration] rebuilding ai_summaries_lang (old 2-col schema)');
      await runSafe([
        `CREATE TABLE IF NOT EXISTS ai_summaries_lang_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id          INTEGER NOT NULL REFERENCES users(id),
          summary_lang     TEXT    NOT NULL DEFAULT 'en',
          summary_calendar TEXT    NOT NULL DEFAULT 'miladi',
          summary          TEXT    NOT NULL,
          expires_at       TEXT    NOT NULL,
          created_at       TEXT    NOT NULL,
          UNIQUE(user_id, summary_lang, summary_calendar)
        )`,
        `INSERT OR IGNORE INTO ai_summaries_lang_new
           (id, user_id, summary_lang, summary_calendar, summary, expires_at, created_at)
         SELECT id, user_id, summary_lang, 'miladi', summary, expires_at, created_at
         FROM ai_summaries_lang`,
        `DROP TABLE ai_summaries_lang`,
        `ALTER TABLE ai_summaries_lang_new RENAME TO ai_summaries_lang`,
      ]);
      console.log('[migration] ai_summaries_lang rebuild complete');
    } else {
      // Column exists — check whether the unique index is still the old 2-col one.
      // Query the index list; if any index on this table covers only (user_id, summary_lang)
      // but NOT summary_calendar, the constraint is still wrong.
      const idxRows = (await db.execute({
        sql: `PRAGMA index_list(ai_summaries_lang)`,
        args: [],
      })).rows as unknown as { name: string; unique: number }[];

      for (const idx of idxRows) {
        if (!idx.unique) continue;
        const infoRows = (await db.execute({
          sql: `PRAGMA index_info(${idx.name})`,
          args: [],
        })).rows as unknown as { name: string }[];
        const cols = infoRows.map(r => r.name);
        // Old constraint: exactly [user_id, summary_lang] — no summary_calendar
        if (
          cols.length === 2 &&
          cols.includes('user_id') &&
          cols.includes('summary_lang') &&
          !cols.includes('summary_calendar')
        ) {
          console.log('[migration] rebuilding ai_summaries_lang (old 2-col unique index)');
          await runSafe([
            `CREATE TABLE IF NOT EXISTS ai_summaries_lang_new (
              id               INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id          INTEGER NOT NULL REFERENCES users(id),
              summary_lang     TEXT    NOT NULL DEFAULT 'en',
              summary_calendar TEXT    NOT NULL DEFAULT 'miladi',
              summary          TEXT    NOT NULL,
              expires_at       TEXT    NOT NULL,
              created_at       TEXT    NOT NULL,
              UNIQUE(user_id, summary_lang, summary_calendar)
            )`,
            `INSERT OR IGNORE INTO ai_summaries_lang_new
               (id, user_id, summary_lang, summary_calendar, summary, expires_at, created_at)
             SELECT id, user_id, summary_lang,
                    COALESCE(summary_calendar, 'miladi'),
                    summary, expires_at, created_at
             FROM ai_summaries_lang`,
            `DROP TABLE ai_summaries_lang`,
            `ALTER TABLE ai_summaries_lang_new RENAME TO ai_summaries_lang`,
          ]);
          console.log('[migration] ai_summaries_lang rebuild complete (index fix)');
          break;
        }
      }
    }
  } catch (e: any) {
    console.warn('[migration] ai_summaries_lang rebuild skipped —', String(e).slice(0, 120));
  }
}
