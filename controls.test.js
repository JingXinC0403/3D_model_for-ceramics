import { describe, expect, it } from 'vitest';
import { CONTROLS, findControl } from '../server/sensors.js';
import { createClient } from '../server/blynk.js';
import { createMockClient } from '../server/mock.js';

describe('control whitelist', () => {
  it('lists only pins explicitly marked as controls', () => {
    expect(CONTROLS.map((c) => c.pin)).toEqual(['v6']);
  });

  it('refuses to recognise a sensor pin as writable', () => {
    expect(findControl('v6')).not.toBeNull();
    expect(findControl('v0')).toBeNull();  // temperature
    expect(findControl('v3')).toBeNull();  // flame
    expect(findControl('v99')).toBeNull(); // nonexistent
  });

  it('keeps the control out of the sensor tile groups', async () => {
    const { GROUPS, SENSORS } = await import('../server/sensors.js');
    const servo = SENSORS.find((s) => s.pin === 'v6');
    expect(GROUPS.map((g) => g.id)).not.toContain(servo.group);
  });
});

describe('writePin', () => {
  const ok = { ok: true, status: 200, text: async () => 'ok', json: async () => ({}) };
  const fail = (status) => ({ ok: false, status, text: async () => '', json: async () => ({}) });

  it('sends the value to Blynk’s update endpoint with the token', async () => {
    const calls = [];
    const client = createClient({
      token: 'tok-123',
      fetchImpl: async (url) => { calls.push(url); return ok; },
    });

    const res = await client.writePin('v6', 1);
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/external/api/update?token=tok-123');
    expect(calls[0]).toContain('v6=1');
  });

  it('reports a rejected token rather than claiming success', async () => {
    const client = createClient({ token: 'bad', fetchImpl: async () => fail(401) });
    const res = await client.writePin('v6', 1);
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('auth');
  });

  it('reports an unreachable Blynk rather than claiming success', async () => {
    const client = createClient({
      token: 'tok',
      fetchImpl: async () => { throw new TypeError('fetch failed'); },
    });
    const res = await client.writePin('v6', 1);
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe('network');
  });
});

describe('mock client writes', () => {
  it('reads back what was written, so the interface reflects the toggle', async () => {
    const client = createMockClient();
    expect((await client.readAll()).values.v6).toBe(0);

    await client.writePin('v6', 1);
    expect((await client.readAll()).values.v6).toBe(1);

    await client.writePin('v6', 0);
    expect((await client.readAll()).values.v6).toBe(0);
  });

  it('leaves the sensor readings alone', async () => {
    const client = createMockClient();
    await client.writePin('v6', 1);
    const { values } = await client.readAll();
    expect(typeof values.v0).toBe('number');
    expect(values.v6).toBe(1);
  });
});
