import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error('TURSO_DATABASE_URL is not set');

export const db = createClient({ url, authToken });

export async function runMigrations(): Promise<void> {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      title       TEXT    NOT NULL,
      description TEXT,
      due_date    TEXT,
      priority    TEXT    DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      status      TEXT    DEFAULT 'open'   CHECK(status   IN ('open','done')),
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bills (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      name       TEXT    NOT NULL,
      amount     REAL,
      due_date   TEXT,
      recurrence TEXT    DEFAULT 'once' CHECK(recurrence IN ('once','monthly','yearly')),
      paid       INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id           INTEGER NOT NULL REFERENCES users(id),
      name              TEXT    NOT NULL,
      amount            REAL,
      billing_cycle     TEXT    CHECK(billing_cycle IN ('weekly','monthly','yearly')),
      next_billing_date TEXT,
      active            INTEGER DEFAULT 1,
      max_repetitions   INTEGER,
      created_at        TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      title      TEXT    NOT NULL,
      remind_at  TEXT    NOT NULL,
      notes      TEXT,
      done       INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      name        TEXT    NOT NULL,
      frequency   TEXT    DEFAULT 'daily' CHECK(frequency IN ('daily','weekly')),
      target_days TEXT    DEFAULT '[]',
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id    INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      logged_date TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(habit_id, logged_date)
    );

    CREATE TABLE IF NOT EXISTS important_dates (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      title         TEXT    NOT NULL,
      date          TEXT    NOT NULL,
      recurs_yearly INTEGER DEFAULT 0,
      notes         TEXT,
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
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
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER UNIQUE NOT NULL REFERENCES users(id),
      calendar   TEXT    NOT NULL DEFAULT 'miladi',
      language   TEXT    NOT NULL DEFAULT 'en',
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS google_tokens (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token    TEXT    NOT NULL,
      refresh_token   TEXT,
      expiry          TEXT,
      drive_folder_id TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id           ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_bills_user_id           ON bills(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id       ON reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_habits_user_id          ON habits(user_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id     ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_important_dates_user_id ON important_dates(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user_id       ON documents(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tokens_user_id ON google_tokens(user_id);

    CREATE TABLE IF NOT EXISTS google_tasks_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token  TEXT    NOT NULL,
      refresh_token TEXT,
      expiry        TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_tasks_tokens_user_id ON google_tasks_tokens(user_id);

    CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER UNIQUE NOT NULL REFERENCES users(id),
      access_token  TEXT    NOT NULL,
      refresh_token TEXT,
      expiry        TEXT,
      calendar_id   TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id ON google_calendar_tokens(user_id);
  `);

  // ALTER TABLE migrations — run individually, ignore "duplicate column" errors for idempotency
  const alterStatements = [
    'ALTER TABLE documents ADD COLUMN drive_file_id TEXT',
    'ALTER TABLE documents ADD COLUMN drive_view_link TEXT',
    'ALTER TABLE tasks ADD COLUMN google_task_id TEXT',
    'ALTER TABLE reminders ADD COLUMN google_calendar_event_id TEXT',
    'ALTER TABLE important_dates ADD COLUMN google_calendar_event_id TEXT',
    'ALTER TABLE tasks ADD COLUMN google_calendar_event_id TEXT',
    // Task groups
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
    'CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON task_groups(user_id)',
    'ALTER TABLE tasks ADD COLUMN task_group_id INTEGER REFERENCES task_groups(id) ON DELETE SET NULL',
    'ALTER TABLE task_groups ADD COLUMN is_default INTEGER DEFAULT 0',
    'ALTER TABLE task_groups ADD COLUMN is_google_default INTEGER DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN max_repetitions INTEGER',
    "ALTER TABLE user_preferences ADD COLUMN language TEXT NOT NULL DEFAULT 'en'",
    'ALTER TABLE habits ADD COLUMN name_en TEXT',
    'ALTER TABLE habits ADD COLUMN name_fa TEXT',
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
    'CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id)',
    'ALTER TABLE user_preferences ADD COLUMN country TEXT DEFAULT NULL',
    // User holiday overrides: hidden/edited API holidays + custom ones
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
    'CREATE INDEX IF NOT EXISTS idx_user_holidays_user ON user_holidays(user_id, country, year)',
    // User weekend overrides: which days are weekends for the user's country
    `CREATE TABLE IF NOT EXISTS user_weekends (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      country      TEXT    NOT NULL,
      weekend_days TEXT    NOT NULL DEFAULT '[]',
      created_at   TEXT    DEFAULT (datetime('now')),
      updated_at   TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, country)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_user_weekends_user ON user_weekends(user_id, country)',
    'ALTER TABLE user_holidays ADD COLUMN name_fa TEXT',
    // Per-language summary storage: one row per (user_id, summary_lang)
    `CREATE TABLE IF NOT EXISTS ai_summaries_lang (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      summary_lang TEXT    NOT NULL DEFAULT 'en',
      summary      TEXT    NOT NULL,
      expires_at   TEXT    NOT NULL,
      created_at   TEXT    NOT NULL,
      UNIQUE(user_id, summary_lang)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_ai_summaries_lang_user ON ai_summaries_lang(user_id, summary_lang)',
    // History: previous summaries pushed before each regeneration or edit
    `CREATE TABLE IF NOT EXISTS ai_summary_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      summary      TEXT    NOT NULL,
      summary_lang TEXT    NOT NULL DEFAULT 'en',
      expires_at   TEXT    NOT NULL,
      created_at   TEXT    NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_ai_summary_history_user ON ai_summary_history(user_id, summary_lang, created_at)',
  ];
  for (const sql of alterStatements) {
    try {
      await db.execute(sql);
    } catch (e: any) {
      // Ignore "duplicate column" — means migration already ran
      if (!String(e).includes('duplicate column')) throw e;
    }
  }

  // Migration: make users.password_hash nullable (needed for Google-only accounts).
  // SQLite cannot ALTER COLUMN, so we recreate the table if the column is still NOT NULL.
  try {
    const tableInfo = (await db.execute("PRAGMA table_info(users)")).rows;
    const col = tableInfo.find((r: any) => r.name === 'password_hash');
    if (col && (col as any).notnull === 1) {
      await db.executeMultiple(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS users_new;
        CREATE TABLE users_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          email         TEXT    UNIQUE NOT NULL,
          password_hash TEXT,
          created_at    TEXT    DEFAULT (datetime('now'))
        );
        INSERT INTO users_new (id, email, password_hash, created_at)
          SELECT id, email, password_hash, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        PRAGMA foreign_keys = ON;
      `);
    }
  } catch (e: any) {
    console.error('Migration users.password_hash nullable failed:', e);
    throw e;
  }
}
