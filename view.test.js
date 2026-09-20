import { describe, expect, it } from 'vitest';
import { formatValue, toneFor } from '../public/view.js';
import { buildPath } from '../public/charts.js';
import { createHistory } from '../public/history.js';
import { SENSORS } from '../server/sensors.js';

const byPin = (pin) => SENSORS.find((s) => s.pin === pin);
const temp = byPin('v0');
const flame = byPin('v3');
const ir = byPin('v5');

describe('toneFor', () => {
  it('is unknown with no reading, which is not the same as zero', () => {
    expect(toneFor(temp, null)).toBe('unknown');
    expect(toneFor(temp, undefined)).toBe('unknown');
    expect(toneFor(temp, 0)).toBe('ok');
  });

  it('maps digital states through the sensor definition', () => {
    expect(toneFor(flame, 0)).toBe('ok');
    expect(toneFor(flame, 1)).toBe('alarm');
    expect(toneFor(ir, 1)).toBe('info');
    expect(toneFor(flame, 7)).toBe('unknown');
  });
});

describe('formatValue', () => {
  it('shows a placeholder rather than a number when there is no reading', () => {
    expect(formatValue(temp, null)).toBe('--');
    expect(formatValue(flame, null)).toBe('--');
  });

  it('respects the configured precision', () => {
    expect(formatValue(temp, 24.456)).toBe('24.5');
    expect(formatValue(byPin('v4'), 0.1234)).toBe('0.12');
  });

  it('labels a digital state', () => {
    expect(formatValue(flame, 1)).toBe('Flame detected');
  });
});

describe('history', () => {
  it('drops the oldest samples once capacity is reached', () => {
    const h = createHistory(['v0'], 3);
    for (let i = 1; i <= 6; i += 1) h.push('v0', i, i);
    expect(h.values('v0')).toEqual([4, 5, 6]);
  });

  it('stores nulls so gaps stay visible', () => {
    const h = createHistory(['v0'], 5);
    h.push('v0', 1);
    h.push('v0', null);
    expect(h.values('v0')).toEqual([1, null]);
  });

  it('records a null for any pin missing from the response', () => {
    const h = createHistory(['v0', 'v1'], 5);
    h.pushAll({ v0: 9 });
    expect(h.latest('v1').v).toBeNull();
  });
});

describe('buildPath', () => {
  const opts = { width: 100, height: 40 };

  it('draws nothing until there are two points', () => {
    expect(buildPath([], opts).d).toBe('');
    expect(buildPath([1], opts).d).toBe('');
    expect(buildPath([null, null], opts).d).toBe('');
  });

  it('handles a flat line without dividing by zero', () => {
    const { d } = buildPath([5, 5, 5], opts);
    expect(d).toMatch(/^M/);
    expect(d).not.toMatch(/NaN/);
  });

  it('breaks the line at nulls instead of interpolating across them', () => {
    expect(buildPath([1, 2, null, 4, 5], opts).d.match(/M/g).length).toBe(2);
  });
});
