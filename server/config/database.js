import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default: <server>/database.sqlite. DATABASE_PATH overrides it (absolute or
// relative to the process cwd) so tests and CI can run against isolated,
// throwaway databases without touching the development one.
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../database.sqlite');

// One shared connection for the process: opening a fresh SQLite connection per
// request (and per middleware hop) is wasteful and means the foreign-key pragma
// below only ever applies to the connection that ran initDatabase().
let dbPromise = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDatabase();

  await db.exec('PRAGMA foreign_keys = ON');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      profile_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Lightweight migration: CREATE TABLE IF NOT EXISTS never alters an existing
  // table, so add columns added after launch explicitly.
  const userColumns = await db.all('PRAGMA table_info(users)');
  if (!userColumns.some((col) => col.name === 'theme')) {
    await db.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'");
  }
  if (!userColumns.some((col) => col.name === 'status')) {
    // Account lifecycle: 'active' | 'suspended' | 'disabled'. Existing rows
    // become 'active' by default. The allow-list is enforced in code
    // (config/security.js ALLOWED_ACCOUNT_STATUSES) — never trust request input.
    await db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS hazards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      causes TEXT NOT NULL,
      effects TEXT NOT NULL,
      prevention TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS hazard_reports (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      hazard_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      severity TEXT NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted',
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS educational_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read_status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Server-side security event log. Distinct from audit_log: audit_log tracks
  // successful admin moderation actions (and requires an admin actor), whereas
  // security_events records authentication/authorization outcomes whose actor
  // may be anonymous (failed logins, invalid/expired tokens, denied admin
  // access). There is deliberately NO foreign key on actor_user_id so that
  // deleting a user account never cascades away security evidence, and no
  // client-facing API ever writes to this table — rows are inserted only by
  // trusted server code (see config/securityLog.js).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS security_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      actor_user_id INTEGER,
      actor_role TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      target_type TEXT,
      target_id TEXT,
      ip TEXT,
      endpoint TEXT,
      reason TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)'
  );

  // Password reset tokens. Single-use, cryptographically random, with a
  // created_at for expiry. Deleted when consumed (successful reset) or when
  // the user changes their password through the normal flow.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id)'
  );

  return db;
}
