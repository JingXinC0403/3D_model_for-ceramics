// Presentation helpers shared by the pages. Pure, so they are unit-testable.

/** 'unknown' means we have no value, which is not the same as zero. */
export function toneFor(sensor, value) {
  if (value === null || value === undefined) return 'unknown';
  if (sensor.kind === 'digital') return sensor.states?.[value]?.tone ?? 'unknown';
  return 'ok';
}

export function formatValue(sensor, value) {
  if (value === null || value === undefined) return '--';
  if (sensor.kind === 'digital') return sensor.states?.[value]?.label ?? String(value);
  return Number(value).toFixed(sensor.decimals ?? 1);
}

/** Replaces every tone-* class on an element with the one given. */
export function setTone(el, tone) {
  el.classList.remove('tone-ok', 'tone-warn', 'tone-alarm', 'tone-info', 'tone-unknown');
  el.classList.add(`tone-${tone}`);
}

export function readJson(id) {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent) : null;
}

export const ageText = (ms) => (ms === null ? 'no data yet' : `updated ${Math.round(ms / 1000)}s ago`);
