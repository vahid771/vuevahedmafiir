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
      password_hash TEXT    NOT NULL,
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
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      title       TEXT    NOT NULL,
      filename    TEXT    NOT NULL,
      mimetype    TEXT,
      size        INTEGER,
      tags        TEXT    DEFAULT '[]',
      uploaded_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id           ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_bills_user_id           ON bills(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_user_id       ON reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_habits_user_id          ON habits(user_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id     ON habit_logs(habit_id);
    CREATE INDEX IF NOT EXISTS idx_important_dates_user_id ON important_dates(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user_id       ON documents(user_id);
  `);
}
