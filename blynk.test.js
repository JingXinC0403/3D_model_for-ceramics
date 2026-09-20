import { describe, expect, it } from 'vitest';
import { classifyStatus, createClient, parseValues, toNumber } from '../server/blynk.js';

const PINS = ['v0', 'v1', 'v3'];

function fakeFetch(handler) {
  return async (url) => handler(url);
}

const ok = (body, json = true) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => (json ? JSON.stringify(body) : String(body)),
});

const fail = (status) => ({ ok: false, status, json: async () => ({}), text: async () => '' });

describe('toNumber', () => {
  it('parses numeric strings', () => {
    expect(toNumber('24.5')).toBe(24.5);
    expect(toNumber('0')).toBe(0);
    expect(toNumber(-3)).toBe(-3);
  });

  it('returns null rather than 0 for missing or junk values', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('   ')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('n/a')).toBeNull();
    expect(toNumber(NaN)).toBeNull();
  });
});

describe('parseValues', () => {
  it('maps every requested pin, filling absent ones with null', () => {
    expect(parseValues({ v0: '24.5' }, PINS)).toEqual({ v0: 24.5, v1: null, v3: null });
  });

  it('accepts upper-case pin keys', () => {
    expect(parseValues({ V0: '1', V3: '0' }, PINS)).toEqual({ v0: 1, v1: null, v3: 0 });
  });
});

describe('classifyStatus', () => {
  it('separates auth failures from rate limits from everything else', () => {
    expect(classifyStatus(400)).toBe('auth');
    expect(classifyStatus(401)).toBe('auth');
    expect(classifyStatus(403)).toBe('auth');
    expect(classifyStatus(429)).toBe('ratelimit');
    expect(classifyStatus(500)).toBe('http');
  });
});

describe('createClient.readAll', () => {
  it('reads all pins in one bulk request', async () => {
    const calls = [];
    const client = createClient({
      pins: PINS,
      fetchImpl: fakeFetch((url) => {
        calls.push(url);
        if (url.includes('isHardwareConnected')) return ok('true', false);
        return ok({ v0: '24.5', v1: '55', v3: '0' });
      }),
    });

    const res = await client.readAll();
    expect(res.ok).toBe(true);
    expect(res.values).toEqual({ v0: 24.5, v1: 55, v3: 0 });
    expect(res.online).toBe(true);
    expect(calls.filter((c) => c.includes('/get?')).length).toBe(1);
  });

  it('falls back to one request per pin when the bulk read is unusable', async () => {
    const perPin = [];
    const client = createClient({
      pins: PINS,
      fetchImpl: fakeFetch((url) => {
        if (url.includes('isHardwareConnected')) return ok('true', false);
        if (url.includes('v0&v1&v3')) return ok({ unexpected: 'shape' });
        perPin.push(url);
        return ok('7', false);
      }),
    });

    const res = await client.readAll();
    expect(res.ok).toBe(true);
    expect(res.values).toEqual({ v0: 7, v1: 7, v3: 7 });
    expect(perPin.length).toBe(3);
  });

  it('reports a bad token as an auth error, not a network error', async () => {
    const client = createClient({ pins: PINS, fetchImpl: fakeFetch(() => fail(401)) });
    const res = await client.readAll();
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('auth');
    expect(res.error.message).toMatch(/token/);
  });

  it('reports an unreachable proxy as a network error', async () => {
    const client = createClient({
      pins: PINS,
      fetchImpl: fakeFetch(() => { throw new TypeError('fetch failed'); }),
    });
    const res = await client.readAll();
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('network');
  });

  it('treats an unanswerable connection check as unknown, not offline', async () => {
    const client = createClient({
      pins: PINS,
      fetchImpl: fakeFetch((url) => {
        if (url.includes('isHardwareConnected')) return fail(500);
        return ok({ v0: '1', v1: '2', v3: '0' });
      }),
    });
    const res = await client.readAll();
    expect(res.ok).toBe(true);
    expect(res.online).toBeNull();
  });
});

describe('per-pin fallback against a partially configured template', () => {
  const respond = (url) => {
    if (url.includes('isHardwareConnected')) return ok('false', false);
    if (url.includes('v0&v1&v3')) return ok({ unexpected: 'shape' });
    if (url.endsWith('&v1')) return fail(400); // exists but never written
    return ok('50', false);
  };

  it('records an unwritten pin as null instead of stopping the dashboard', async () => {
    const client = createClient({ pins: PINS, fetchImpl: fakeFetch(respond) });
    const res = await client.readAll();
    expect(res.ok).toBe(true);
    expect(res.values).toEqual({ v0: 50, v1: null, v3: 50 });
  });

  it('still reports an error when every single pin fails', async () => {
    const client = createClient({
      pins: PINS,
      fetchImpl: fakeFetch((url) => {
        if (url.includes('isHardwareConnected')) return ok('false', false);
        if (url.includes('v0&v1&v3')) return ok({ unexpected: 'shape' });
        return fail(401);
      }),
    });
    const res = await client.readAll();
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('auth');
  });
});
