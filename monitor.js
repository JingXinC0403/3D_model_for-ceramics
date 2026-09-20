// Decides whether the box's atmosphere suits the artifacts stored in it.
// Pure functions: no network, no database, no DOM.

import { ROLE_PINS, SENSORS } from './sensors.js';

const METRICS = [
  { role: 'temperature', label: 'Temperature', unit: '°C', min: 'temp_min', max: 'temp_max' },
  { role: 'humidity',    label: 'Humidity',    unit: '%',  min: 'rh_min',   max: 'rh_max' },
];

/**
 * Compare one artifact's ideal ranges against the current readings.
 * A metric with no reading is skipped, not treated as a breach — and if no metric
 * can be read at all, the verdict is 'unknown' rather than a false all-clear.
 */
export function evaluateArtifact(artifact, values) {
  const breaches = [];
  let readable = 0;

  for (const metric of METRICS) {
    const value = values?.[ROLE_PINS[metric.role]];
    if (value === null || value === undefined) continue;
    readable += 1;

    const min = artifact[metric.min];
    const max = artifact[metric.max];

    if (value < min) {
      breaches.push({ ...pick(metric), value, min, max, direction: 'below', by: round(min - value) });
    } else if (value > max) {
      breaches.push({ ...pick(metric), value, min, max, direction: 'above', by: round(value - max) });
    }
  }

  if (readable === 0) return { status: 'unknown', breaches: [] };
  return { status: breaches.length ? 'warn' : 'ok', breaches };
}

const pick = (m) => ({ role: m.role, label: m.label, unit: m.unit });
const round = (n) => Math.round(n * 10) / 10;

/** Digital sensors flagged as alarms in the sensor map, currently reading high. */
export function firingAlarms(values) {
  return SENSORS
    .filter((s) => s.alarm && values?.[s.pin] === 1)
    .map((s) => ({ pin: s.pin, name: s.name }));
}

/**
 * The whole verdict for the box: every artifact judged, the tone each climate
 * tile should wear, and the single status word for the header.
 */
export function evaluateBox({ artifacts = [], values = null, online = null, error = null } = {}) {
  const judged = artifacts.map((a) => ({
    id: a.id,
    name: a.name,
    material: a.material,
    ranges: { tempMin: a.temp_min, tempMax: a.temp_max, rhMin: a.rh_min, rhMax: a.rh_max },
    ...evaluateArtifact(a, values),
  }));

  const alarms = values ? firingAlarms(values) : [];

  // A climate tile turns amber when any artifact objects to what it is reading.
  const roleTones = {};
  for (const metric of METRICS) {
    const breached = judged.some((a) => a.breaches.some((b) => b.role === metric.role));
    const value = values?.[ROLE_PINS[metric.role]];
    roleTones[metric.role] = value === null || value === undefined
      ? 'unknown'
      : (breached ? 'warn' : 'ok');
  }

  let status = 'ok';
  let label = 'Normal';
  if (alarms.length) {
    status = 'alarm';
    label = 'Alarm';
  } else if (online === false) {
    status = 'alarm';
    label = 'Offline';
  } else if (error) {
    status = 'warn';
    label = 'Trouble';
  } else if (judged.some((a) => a.status === 'warn')) {
    status = 'warn';
    label = 'Unsuitable';
  } else if (!values || judged.every((a) => a.status === 'unknown')) {
    status = judged.length ? 'unknown' : 'ok';
    label = judged.length ? 'No reading' : 'Normal';
  }

  return {
    status,
    label,
    alarms,
    roleTones,
    artifacts: judged,
    atRisk: judged.filter((a) => a.status === 'warn').length,
  };
}

/** One-line description of a breach, for the warning banner. */
export function describeBreach(artifactName, breach) {
  const direction = breach.direction === 'above' ? 'above' : 'below';
  const limit = breach.direction === 'above' ? breach.max : breach.min;
  return `${artifactName}: ${breach.label.toLowerCase()} ${breach.value}${breach.unit} is ${breach.by}${breach.unit} ${direction} its ${limit}${breach.unit} limit`;
}
