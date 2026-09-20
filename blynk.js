// Blynk Cloud read-only client, now server-side: the token never reaches a browser.

import { PINS } from './sensors.js';

/** '' and non-numeric junk become null, never 0. A missing reading is not a real one. */
export function toNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a Blynk response object into { v0: number|null, ... } for every pin. */
export function parseValues(body, pins = PINS) {
  const out = {};
  for (const pin of pins) {
    const raw = body?.[pin] ?? body?.[pin.toUpperCase()];
    out[pin] = toNumber(raw);
  }
  return out;
}

/** A bad token and a dead network need different messages, so they are classified apart. */
export function classifyStatus(status) {
  if (status === 400 || status === 401 || status === 403) return 'auth';
  if (status === 429) return 'ratelimit';
  return 'http';
}

const MESSAGES = {
  auth: 'Blynk rejected this space’s token. Check it in the space settings.',
  ratelimit: 'Blynk is rate limiting this device. Readings will resume shortly.',
  http: 'Blynk returned an unexpected response.',
  network: 'Cannot reach Blynk. Check this machine’s internet connection.',
};

export function messageFor(kind) {
  return MESSAGES[kind] ?? MESSAGES.http;
}

export function createClient({ token, region = 'blynk.cloud', pins = PINS, fetchImpl = fetch } = {}) {
  const base = `https://${region}/external/api`;
  const url = (path, query) => `${base}/${path}?token=${encodeURIComponent(token)}${query ? `&${query}` : ''}`;

  // Blynk's multi-pin read is the documented path but is not guaranteed on every plan.
  // If it comes back unusable once, stop trying it and read pin by pin instead.
  let bulkSupported = true;

  async function getOk(target) {
    const res = await fetchImpl(target);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.kind = classifyStatus(res.status);
      throw err;
    }
    return res;
  }

  async function readBulk() {
    const res = await getOk(url('get', pins.join('&')));
    const body = await res.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const values = parseValues(body, pins);
    // Every pin null means the shape was not what we expected, not that the box is idle.
    return Object.values(values).some((v) => v !== null) ? values : null;
  }

  async function readEach() {
    const values = {};
    let failed = 0;
    let lastError = null;

    for (const pin of pins) {
      try {
        const res = await getOk(url('get', pin));
        values[pin] = toNumber((await res.text()).replace(/^"|"$/g, ''));
      } catch (e) {
        // Blynk answers 400 for a pin that exists but has never been written, and
        // for one the template does not define. Neither should stop the dashboard.
        values[pin] = null;
        failed += 1;
        lastError = e;
      }
    }

    // Every pin failing is a different problem — a bad token, say — so surface it.
    if (failed === pins.length) throw lastError;
    return values;
  }

  async function isOnline() {
    try {
      const res = await getOk(url('isHardwareConnected'));
      return (await res.text()).trim() === 'true';
    } catch {
      return null; // unknown, which is not the same as offline
    }
  }

  async function readAll() {
    try {
      let values = null;
      if (bulkSupported) {
        values = await readBulk();
        if (values === null) bulkSupported = false;
      }
      if (values === null) values = await readEach();

      return { ok: true, values, online: await isOnline(), error: null };
    } catch (e) {
      const kind = e.kind ?? 'network';
      return { ok: false, values: null, online: null, error: { kind, message: messageFor(kind) } };
    }
  }

  /**
   * Write one virtual pin. The caller is responsible for checking the pin is a
   * control — this client will write whatever it is handed.
   */
  async function writePin(pin, value) {
    try {
      await getOk(url('update', `${pin}=${encodeURIComponent(value)}`));
      return { ok: true, error: null };
    } catch (e) {
      const kind = e.kind ?? 'network';
      return { ok: false, error: { kind, message: messageFor(kind) } };
    }
  }

  return { readAll, writePin };
}
