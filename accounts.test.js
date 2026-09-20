import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hashPassword, validateCredentials, verifyPassword } from '../server/auth.js';
import { openDatabase } from '../server/db.js';

describe('password hashing', () => {
  it('never stores the password itself', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toContain('correct horse battery');
    expect(hash.startsWith('scrypt:')).toBe(true);
  });

  it('salts, so the same password hashes differently every time', async () => {
    expect(await hashPassword('same-password')).not.toBe(await hashPassword('same-password'));
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret-passphrase');
    expect(await verifyPassword('s3cret-passphrase', hash)).toBe(true);
    expect(await verifyPassword('s3cret-passphras', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
    expect(await verifyPassword('x', 'scrypt:only-two')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('requires an email that looks like one', () => {
    expect(validateCredentials('not-an-email', 'longenough')).toMatch(/valid email/);
    expect(validateCredentials('', 'longenough')).toMatch(/valid email/);
    expect(validateCredentials('a@b.co', 'longenough')).toBeNull();
  });

  it('requires at least eight characters of password', () => {
    expect(validateCredentials('a@b.co', 'short')).toMatch(/8 characters/);
    expect(validateCredentials('a@b.co', '12345678')).toBeNull();
  });
});

const sampleArtifact = (name = 'Logbook') => ({
  name, material: 'paper', notes: '',
  tempMin: 16, tempMax: 20, rhMin: 45, rhMax: 55,
});

describe('accounts', () => {
  let store;

  beforeEach(() => {
    store = openDatabase(':memory:');
  });

  it('finds a user by email and nothing by an unknown one', () => {
    const alice = store.createUser('alice@example.com', 'scrypt:x:y');
    expect(store.findUserByEmail('alice@example.com').id).toBe(alice.id);
    expect(store.findUserByEmail('nobody@example.com')).toBeNull();
  });

  it('refuses a duplicate email', () => {
    store.createUser('alice@example.com', 'scrypt:x:y');
    expect(() => store.createUser('alice@example.com', 'scrypt:x:y')).toThrow();
  });

  it('expires a session and stops honouring it', () => {
    const alice = store.createUser('alice@example.com', 'scrypt:x:y');

    const live = store.createSession(alice.id, 'csrf', 60_000);
    expect(store.findSession(live).user_id).toBe(alice.id);

    const dead = store.createSession(alice.id, 'csrf', -1);
    expect(store.findSession(dead)).toBeNull();
  });
});

describe('artifacts', () => {
  let store;

  beforeEach(() => {
    store = openDatabase(':memory:');
  });

  it('stores an artifact and reads it back', () => {
    const id = store.createArtifact(sampleArtifact());
    expect(store.findArtifact(id)).toMatchObject({ name: 'Logbook', temp_min: 16, rh_max: 55 });
    expect(store.countArtifacts()).toBe(1);
  });

  it('lists artifacts in the order they were recorded', () => {
    store.createArtifact(sampleArtifact('First'));
    store.createArtifact(sampleArtifact('Second'));
    expect(store.listArtifacts().map((a) => a.name)).toEqual(['First', 'Second']);
  });

  it('updates limits in place', () => {
    const id = store.createArtifact(sampleArtifact());
    store.updateArtifact(id, { ...sampleArtifact('Logbook v2'), tempMax: 24 });

    expect(store.findArtifact(id)).toMatchObject({ name: 'Logbook v2', temp_max: 24 });
    expect(store.countArtifacts()).toBe(1);
  });

  it('deletes an artifact', () => {
    const id = store.createArtifact(sampleArtifact());
    store.deleteArtifact(id);
    expect(store.findArtifact(id)).toBeNull();
    expect(store.listArtifacts()).toEqual([]);
  });

  it('returns null for an artifact that does not exist', () => {
    expect(store.findArtifact('no-such-id')).toBeNull();
  });

  // Artifacts describe the contents of one physical box, so they are deliberately
  // shared: every signed-in account sees the same list. This is not an oversight.
  it('shows the same artifacts to every account', () => {
    store.createUser('alice@example.com', 'scrypt:x:y');
    store.createUser('bob@example.com', 'scrypt:x:y');
    store.createArtifact(sampleArtifact('Shared bowl'));

    expect(store.listArtifacts().map((a) => a.name)).toEqual(['Shared bowl']);
  });
});

describe('migration from the multi-space schema', () => {
  let file;
  let opened;

  // Windows will not delete a file SQLite still holds open, so every connection
  // this suite makes is tracked and closed before cleanup.
  const open = (path) => {
    const store = openDatabase(path);
    opened.push(store.raw);
    return store;
  };

  beforeEach(() => {
    file = join(tmpdir(), `care-test-${randomUUID()}.db`);
    opened = [];
  });

  afterEach(() => {
    for (const db of opened) {
      try { db.close(); } catch { /* already closed */ }
    }
    for (const suffix of ['', '-shm', '-wal']) {
      rmSync(file + suffix, { force: true });
    }
  });

  it('keeps existing artifacts and drops the spaces table', () => {
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, created_at INTEGER);
      CREATE TABLE spaces (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, blynk_token TEXT,
                           blynk_region TEXT, created_at INTEGER);
      CREATE TABLE artifacts (id TEXT PRIMARY KEY, space_id TEXT, name TEXT, material TEXT,
                              notes TEXT, temp_min REAL, temp_max REAL, rh_min REAL, rh_max REAL,
                              created_at INTEGER);
      INSERT INTO users VALUES ('u1', 'keep@example.com', 'scrypt:x:y', 1);
      INSERT INTO spaces VALUES ('s1', 'u1', 'Old case', 'tok', 'blynk.cloud', 1);
      INSERT INTO artifacts VALUES ('a1', 's1', 'Ming bowl', 'ceramic', '', 15, 25, 40, 60, 1);
    `);
    old.close();

    const store = open(file);

    expect(store.findUserByEmail('keep@example.com')).not.toBeNull();
    expect(store.listArtifacts()).toHaveLength(1);
    expect(store.findArtifact('a1')).toMatchObject({ name: 'Ming bowl', temp_max: 25 });

    const tables = store.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);
    expect(tables).not.toContain('spaces');
    expect(tables).toContain('artifacts');
  });

  it('is safe to run twice', () => {
    open(file);
    const store = open(file);
    const id = store.createArtifact(sampleArtifact());
    expect(store.findArtifact(id)).not.toBeNull();
  });
});
