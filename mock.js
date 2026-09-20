// Synthetic readings for a space whose token is the literal word "mock".
// Lets you build, demo and test the whole site with no hardware attached.

import { PINS } from './sensors.js';

export function createMockClient({ pins = PINS } = {}) {
  let tick = 0;
  const written = new Map();
  const noise = (a) => (Math.random() - 0.5) * a;

  async function readAll() {
    tick += 1;
    const phase = tick / 12;

    const all = {
      v0: 19 + Math.sin(phase) * 6 + noise(0.3),       // drifts in and out of ideal ranges
      v1: 52 + Math.cos(phase / 2) * 14 + noise(0.6),
      v3: tick % 45 >= 38 ? 1 : 0,                     // flame trips periodically
      v4: noise(0.25),
      v5: tick % 17 >= 14 ? 1 : 0,
      v6: 0,
      v7: noise(0.25),
      v8: 0.98 + noise(0.06),
      v9: noise(14),
      v10: noise(14),
      v11: noise(14),
    };

    const values = {};
    for (const pin of pins) {
      values[pin] = written.has(pin) ? written.get(pin) : (all[pin] ?? null);
    }
    return { ok: true, values, online: true, error: null };
  }

  // Writes stick, so toggling a control in mock mode behaves like real hardware.
  async function writePin(pin, value) {
    written.set(pin, Number(value));
    return { ok: true, error: null };
  }

  return { readAll, writePin };
}
