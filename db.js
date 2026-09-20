// SQLite via node:sqlite (built into Node 22.5+) so there is no native build step.
// One file on disk, created on first run.

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  material   TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  temp_min   REAL NOT NULL,
  temp_max   REAL NOT NULL,
  rh_min     REAL NOT NULL,
  rh_max     REAL NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/**
 * Collapses the earlier multi-space schema onto the single box.
 * Artifacts keep their records; the spaces table goes away.
 */
function migrate(db) {
  const columns = db.prepare('PRAGMA table_info(artifacts)').all();
  const hasSpaceId = columns.some((c) => c.name === 'space_id');

  if (hasSpaceId) {
    db.exec(`
      CREATE TABLE artifacts_new (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        material   TEXT NOT NULL,
        notes      TEXT NOT NULL DEFAULT '',
        temp_min   REAL NOT NULL,
        temp_max   REAL NOT NULL,
        rh_min     REAL NOT NULL,
        rh_max     REAL NOT NULL,
        created_at INTEGER NOT NULL
      );
      INSERT INTO artifacts_new
        SELECT id, name, material, notes, temp_min, temp_max, rh_min, rh_max, created_at
        FROM artifacts;
      DROP TABLE artifacts;
      ALTER TABLE artifacts_new RENAME TO artifacts;
    `);
  }

  db.exec('DROP TABLE IF EXISTS spaces');
}

export function openDatabase(file = 'care.db') {
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  migrate(db);
  return createStore(db);
}

function createStore(db) {
  const now = () => Date.now();
  const q = (sql) => db.prepare(sql);

  const stmt = {
    insertUser: q('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    userByEmail: q('SELECT * FROM users WHERE email = ?'),
    userById: q('SELECT * FROM users WHERE id = ?'),

    insertSession: q('INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)'),
    sessionById: q('SELECT * FROM sessions WHERE id = ?'),
    deleteSession: q('DELETE FROM sessions WHERE id = ?'),
    purgeSessions: q('DELETE FROM sessions WHERE expires_at < ?'),

    insertArtifact: q(`INSERT INTO artifacts
      (id, name, material, notes, temp_min, temp_max, rh_min, rh_max, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    allArtifacts: q('SELECT * FROM artifacts ORDER BY created_at'),
    artifactById: q('SELECT * FROM artifacts WHERE id = ?'),
    updateArtifact: q(`UPDATE artifacts SET name = ?, material = ?, notes = ?,
      temp_min = ?, temp_max = ?, rh_min = ?, rh_max = ? WHERE id = ?`),
    deleteArtifact: q('DELETE FROM artifacts WHERE id = ?'),
  };

  return {
    raw: db,

    createUser(email, passwordHash) {
      const id = randomUUID();
      stmt.insertUser.run(id, email, passwordHash, now());
      return stmt.userById.get(id);
    },
    findUserByEmail: (email) => stmt.userByEmail.get(email) ?? null,

    createSession(userId, csrf, ttlMs) {
      const id = randomUUID();
      stmt.insertSession.run(id, userId, csrf, now() + ttlMs);
      return id;
    },
    findSession(id) {
      const row = stmt.sessionById.get(id);
      if (!row) return null;
      if (row.expires_at < now()) {
        stmt.deleteSession.run(id);
        return null;
      }
      return row;
    },
    destroySession: (id) => stmt.deleteSession.run(id),
    purgeExpiredSessions: () => stmt.purgeSessions.run(now()),

    // Artifacts describe what is physically in the box, so every signed-in
    // account sees the same list.
    createArtifact(a) {
      const id = randomUUID();
      stmt.insertArtifact.run(id, a.name, a.material, a.notes,
        a.tempMin, a.tempMax, a.rhMin, a.rhMax, now());
      return id;
    },
    listArtifacts: () => stmt.allArtifacts.all(),
    findArtifact: (id) => stmt.artifactById.get(id) ?? null,
    updateArtifact: (id, a) =>
      stmt.updateArtifact.run(a.name, a.material, a.notes,
        a.tempMin, a.tempMax, a.rhMin, a.rhMax, id),
    deleteArtifact: (id) => stmt.deleteArtifact.run(id),
    countArtifacts: () => stmt.allArtifacts.all().length,
  };
}
