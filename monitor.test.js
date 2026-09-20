import { describe, expect, it } from 'vitest';
import { describeBreach, evaluateArtifact, evaluateBox, firingAlarms } from '../server/monitor.js';
import { normalizeReadings } from '../server/sensors.js';

// A paper artifact: 16-20 C, 45-55 % RH.
const paper = { id: 'a1', name: 'Logbook', material: 'paper', temp_min: 16, temp_max: 20, rh_min: 45, rh_max: 55 };
const metal = { id: 'a2', name: 'Kris blade', material: 'metal', temp_min: 15, temp_max: 22, rh_min: 20, rh_max: 40 };
// Paper and metal have no overlapping humidity range, so a box holding both can
// never satisfy them at once. Wood overlaps paper, which is the realistic pairing.
const wood = { id: 'a3', name: 'Carved panel', material: 'wood', temp_min: 18, temp_max: 22, rh_min: 45, rh_max: 60 };

const readings = (temp, rh, extra = {}) => ({ v0: temp, v1: rh, v3: 0, v5: 0, ...extra });

describe('evaluateArtifact', () => {
  it('passes an artifact sitting inside both ranges', () => {
    expect(evaluateArtifact(paper, readings(18, 50))).toEqual({ status: 'ok', breaches: [] });
  });

  it('treats the limits themselves as acceptable', () => {
    expect(evaluateArtifact(paper, readings(16, 45)).status).toBe('ok');
    expect(evaluateArtifact(paper, readings(20, 55)).status).toBe('ok');
  });

  it('flags a reading above the maximum and says by how much', () => {
    const { status, breaches } = evaluateArtifact(paper, readings(23.5, 50));
    expect(status).toBe('warn');
    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({ role: 'temperature', direction: 'above', by: 3.5, max: 20 });
  });

  it('flags a reading below the minimum', () => {
    const { breaches } = evaluateArtifact(paper, readings(18, 30));
    expect(breaches[0]).toMatchObject({ role: 'humidity', direction: 'below', by: 15, min: 45 });
  });

  it('reports both metrics when both are out', () => {
    expect(evaluateArtifact(paper, readings(28, 80)).breaches).toHaveLength(2);
  });

  it('is unknown, not ok, when nothing can be read', () => {
    expect(evaluateArtifact(paper, readings(null, null))).toEqual({ status: 'unknown', breaches: [] });
    expect(evaluateArtifact(paper, null).status).toBe('unknown');
  });

  it('judges on the metric it does have when the other is missing', () => {
    expect(evaluateArtifact(paper, readings(18, null)).status).toBe('ok');
    expect(evaluateArtifact(paper, readings(35, null)).status).toBe('warn');
  });

  it('applies each artifact its own limits, not a shared one', () => {
    const air = readings(18, 38);
    expect(evaluateArtifact(paper, air).status).toBe('warn'); // too dry for paper
    expect(evaluateArtifact(metal, air).status).toBe('ok');   // fine for metal
  });
});

describe('firingAlarms', () => {
  it('reports only sensors marked as alarms', () => {
    expect(firingAlarms({ v3: 1, v5: 1 })).toEqual([{ pin: 'v3', name: 'Flame Sensor' }]);
    expect(firingAlarms({ v3: 0, v5: 1 })).toEqual([]);
  });
});

describe('evaluateBox', () => {
  const base = { artifacts: [paper, wood], online: true, error: null };

  it('is normal when every artifact is content', () => {
    const v = evaluateBox({ ...base, values: readings(19, 50) });
    expect(v).toMatchObject({ status: 'ok', label: 'Normal', atRisk: 0 });
  });

  it('calls the box unsuitable and counts the artifacts at risk', () => {
    const v = evaluateBox({ ...base, values: readings(19, 58) }); // too damp for paper only
    expect(v.status).toBe('warn');
    expect(v.label).toBe('Unsuitable');
    expect(v.atRisk).toBe(1);
  });

  it('ranks a flame alarm above an unsuitable atmosphere', () => {
    const v = evaluateBox({ ...base, values: readings(40, 90, { v3: 1 }) });
    expect(v.status).toBe('alarm');
    expect(v.label).toBe('Alarm');
    expect(v.alarms).toHaveLength(1);
  });

  it('reports an offline box distinctly from a read error', () => {
    expect(evaluateBox({ ...base, values: readings(18, 50), online: false }).label).toBe('Offline');
    expect(evaluateBox({ ...base, values: null, online: null, error: { kind: 'network' } }).label).toBe('Trouble');
  });

  it('tones a climate tile by whether any artifact objects to it', () => {
    const v = evaluateBox({ ...base, values: readings(19, 58) });
    expect(v.roleTones).toEqual({ temperature: 'ok', humidity: 'warn' });
  });

  it('marks a climate tone unknown when that reading is missing', () => {
    const v = evaluateBox({ ...base, values: readings(19, null) });
    expect(v.roleTones.humidity).toBe('unknown');
  });

  it('is normal, not unknown, for a box with no artifacts yet', () => {
    expect(evaluateBox({ artifacts: [], values: readings(18, 50), online: true }).label).toBe('Normal');
  });
});

describe('describeBreach', () => {
  it('spells out the artifact, the reading, and the limit it passed', () => {
    const { breaches } = evaluateArtifact(paper, readings(23.5, 50));
    expect(describeBreach('Logbook', breaches[0]))
      .toBe('Logbook: temperature 23.5°C is 3.5°C above its 20°C limit');
  });
});

describe('normalizeReadings', () => {
  it('inverts the active-low flame sensor so 1 always means tripped', () => {
    // The board reports HIGH when clear, which is what the box sends while nothing burns.
    expect(normalizeReadings({ v3: 1 }).v3).toBe(0);
    expect(normalizeReadings({ v3: 0 }).v3).toBe(1);
  });

  it('leaves sensors that are not active-low alone', () => {
    expect(normalizeReadings({ v5: 1, v0: 22.5 })).toMatchObject({ v5: 1, v0: 22.5 });
  });

  it('passes a missing reading through rather than inventing a state', () => {
    expect(normalizeReadings({ v3: null }).v3).toBeNull();
    expect(normalizeReadings({}).v3).toBeUndefined();
    expect(normalizeReadings(null)).toBeNull();
  });

  it('does not mutate the values it was given', () => {
    const original = { v3: 1 };
    normalizeReadings(original);
    expect(original.v3).toBe(1);
  });

  it('means a quiet box raises no alarm', () => {
    expect(firingAlarms(normalizeReadings({ v3: 1 }))).toEqual([]);
    expect(firingAlarms(normalizeReadings({ v3: 0 }))).toEqual([{ pin: 'v3', name: 'Flame Sensor' }]);
  });
});
