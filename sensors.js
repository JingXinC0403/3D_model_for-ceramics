// The physical sensor set inside a CARE box. One map, shared by every space.
// Change a pin or a unit here and both the server and the browser follow.

export const SENSORS = [
  { pin: 'v0',  name: 'Temperature',    unit: '°C',  group: 'climate',   kind: 'number',  decimals: 1, featured: true, role: 'temperature' },
  { pin: 'v1',  name: 'Humidity',       unit: '%',   group: 'climate',   kind: 'number',  decimals: 1, featured: true, role: 'humidity' },
  // activeLow: this board drives its output LOW on flame and HIGH when clear, which
  // is the opposite of what the pin value suggests. Readings are inverted on arrival
  // so everything downstream sees 1 = flame. Remove the flag if the sketch starts
  // sending `!digitalRead(FLAME_PIN)` instead.
  { pin: 'v3',  name: 'Flame Sensor',   group: 'detection', kind: 'digital', alarm: true, activeLow: true,
    states: { 0: { label: 'Clear', tone: 'ok' }, 1: { label: 'Flame detected', tone: 'alarm' } } },
  { pin: 'v5',  name: 'IR Sensor',      group: 'detection', kind: 'digital',
    states: { 0: { label: 'Clear', tone: 'ok' }, 1: { label: 'Object detected', tone: 'info' } } },
  // A control, not a sensor: the Blynk button the ESP32 watches to drive the servo.
  // Its group is deliberately absent from GROUPS so it never renders as a sensor tile.
  { pin: 'v6',  name: 'Servo', group: 'control', kind: 'digital', control: true,
    states: { 0: { label: 'Off', tone: 'unknown' }, 1: { label: 'On', tone: 'info' } } },
  { pin: 'v4',  name: 'Accel X',        unit: 'g',   group: 'motion',    kind: 'number', decimals: 2 },
  { pin: 'v7',  name: 'Accel Y',        unit: 'g',   group: 'motion',    kind: 'number', decimals: 2 },
  { pin: 'v8',  name: 'Accel Z',        unit: 'g',   group: 'motion',    kind: 'number', decimals: 2 },
  { pin: 'v9',  name: 'Gyro X',         unit: '°/s', group: 'motion',    kind: 'number', decimals: 1 },
  { pin: 'v10', name: 'Gyro Y',         unit: '°/s', group: 'motion',    kind: 'number', decimals: 1 },
  { pin: 'v11', name: 'Gyro Z',         unit: '°/s', group: 'motion',    kind: 'number', decimals: 1 },
];

export const GROUPS = [
  { id: 'climate',   label: 'Climate' },
  { id: 'detection', label: 'Detection' },
  { id: 'motion',    label: 'Inertial' },
];

export const PINS = SENSORS.map((s) => s.pin);

/** Pins the site is allowed to write. Anything not listed here can only be read. */
export const CONTROLS = SENSORS.filter((s) => s.control);

export const findControl = (pin) => CONTROLS.find((c) => c.pin === pin) ?? null;

/** Which pin carries the reading an artifact range is measured against. */
export const ROLE_PINS = {
  temperature: 'v0',
  humidity: 'v1',
};

/**
 * Flips any sensor wired active-low, so the rest of the app can assume
 * 1 means "tripped" for every digital pin. Anything that is not 0 or 1 —
 * a null, an analog value — passes through untouched.
 */
export function normalizeReadings(values) {
  if (!values) return values;

  const out = { ...values };
  for (const sensor of SENSORS) {
    if (!sensor.activeLow) continue;
    const raw = out[sensor.pin];
    if (raw === 0 || raw === 1) out[sensor.pin] = raw === 1 ? 0 : 1;
  }
  return out;
}

export const POLL_INTERVAL_MS = 2000;
export const HISTORY_SIZE = 150;
