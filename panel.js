// The live monitor. Runs on two pages:
//   the box page, which lists artifact verdicts and no sensor readings; and
//   an artifact page, which adds the sensor grid and judges it by that artifact.
// Everything is driven by whichever elements the page actually contains.

import { createHistory } from './history.js';
import { sparkline } from './charts.js';
import { ageText, formatValue, readJson, setTone, toneFor } from './view.js';

const { sensors, groups, pollMs, focusArtifact = null } = readJson('sensors');
const STALE_AFTER = pollMs * 3;
const MAX_BACKOFF_MS = 30000;

const history = createHistory(sensors.map((s) => s.pin));
const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('box-status');
const bannersEl = document.getElementById('banners');

let lastSuccess = null;
let failures = 0;
let latest = null;

// Tiles are built once; polling only updates their contents.
function buildGrid() {
  if (!gridEl) return;
  gridEl.innerHTML = groups.map((group) => {
    const tiles = sensors.filter((s) => s.group === group.id);
    if (!tiles.length) return '';

    return `<section class="group">
      <h3 class="group-label">${group.label}</h3>
      <div class="group-grid">
        ${tiles.map((s) => `
          <article class="tile tone-unknown ${s.featured ? 'tile--featured' : ''}" data-pin="${s.pin}">
            <header class="tile-head">
              <h4 class="tile-name">${s.name}</h4>
              <span class="tile-pin">${s.pin.toUpperCase()}</span>
            </header>
            ${s.kind === 'digital'
              ? '<div class="state"><span class="lamp" aria-hidden="true"></span><span class="state-label" data-field="value">--</span></div>'
              : `<div class="readout"><span class="num" data-field="value">--</span><span class="unit">${s.unit ?? ''}</span></div>
                 <div class="chart" data-field="chart"></div>`}
          </article>`).join('')}
      </div>
    </section>`;
  }).join('');
}

function paintTiles(stale, roleTones) {
  if (!gridEl) return;

  for (const sensor of sensors) {
    const tile = gridEl.querySelector(`[data-pin="${sensor.pin}"]`);
    if (!tile) continue;

    const value = history.latest(sensor.pin)?.v ?? null;
    // A climate tile wears the verdict of the artifacts that care about it.
    const tone = roleTones?.[sensor.role] ?? toneFor(sensor, value);

    setTone(tile, tone);
    tile.classList.toggle('is-stale', stale);
    tile.querySelector('[data-field="value"]').textContent = formatValue(sensor, value);

    const chart = tile.querySelector('[data-field="chart"]');
    if (chart) {
      chart.innerHTML = sparkline(history.values(sensor.pin), {
        height: sensor.featured ? 92 : 46,
        tone,
      });
    }
  }
}

/**
 * On an artifact page the climate tiles answer "does this suit THIS object",
 * not "does this suit everything in the box", so the tones come from its verdict.
 */
function focusTones(verdict) {
  const judged = verdict?.artifacts?.find((a) => a.id === focusArtifact);
  if (!judged) return verdict?.roleTones;

  const tones = {};
  for (const sensor of sensors) {
    if (!sensor.role) continue;
    const value = history.latest(sensor.pin)?.v ?? null;
    tones[sensor.role] = value === null
      ? 'unknown'
      : (judged.breaches.some((b) => b.role === sensor.role) ? 'warn' : 'ok');
  }
  return tones;
}

/** Controls live outside the sensor grid, rendered by the server with their forms. */
function paintControls() {
  for (const el of document.querySelectorAll('[data-control]')) {
    const sensor = sensors.find((s) => s.pin === el.dataset.control);
    if (!sensor) continue;

    const value = history.latest(sensor.pin)?.v ?? null;
    setTone(el, toneFor(sensor, value));
    el.querySelector('[data-field="state"]').textContent =
      value === null ? 'unknown' : formatValue(sensor, value).toLowerCase();
  }
}

function paintArtifacts(verdict) {
  for (const judged of verdict?.artifacts ?? []) {
    const card = document.querySelector(`[data-artifact="${judged.id}"]`);
    if (!card) continue;

    setTone(card, judged.status);
    card.querySelector('[data-field="status"]').textContent = {
      ok: 'Suitable', warn: 'Unsuitable', unknown: 'No reading',
    }[judged.status];

    card.querySelector('[data-field="verdict"]').textContent = judged.breaches.length
      ? judged.breaches.map(describe).join(' · ')
      : (judged.status === 'ok' ? 'Conditions are within its limits.' : 'Waiting for a reading…');
  }
}

function describe(b) {
  const direction = b.direction === 'above' ? 'above' : 'below';
  const limit = b.direction === 'above' ? b.max : b.min;
  return `${b.label} ${b.value.toFixed(1)}${b.unit} — ${b.by}${b.unit} ${direction} the ${limit}${b.unit} limit`;
}

function paintBanners(verdict, error, online) {
  const items = [];

  for (const alarm of verdict?.alarms ?? []) {
    items.push({ tone: 'alarm', title: `${alarm.name} tripped`, detail: `${alarm.pin.toUpperCase()} reading high` });
  }

  if (online === false) {
    items.push({ tone: 'alarm', title: 'Box offline', detail: 'Blynk has no connection to the ESP32. Check its power and WiFi.' });
  }

  if (error) items.push({ tone: 'warn', title: 'Cannot read the box', detail: error.message });

  // An artifact page reports on its own object; the box page reports on all of them.
  const relevant = (verdict?.artifacts ?? [])
    .filter((a) => !focusArtifact || a.id === focusArtifact);

  for (const a of relevant) {
    if (a.status !== 'warn') continue;
    items.push({ tone: 'warn', title: `${a.name} is outside its limits`, detail: a.breaches.map(describe).join(' · ') });
  }

  bannersEl.hidden = items.length === 0;
  bannersEl.innerHTML = items.map((i) => `<div class="banner tone-${i.tone}" role="alert">
      <span class="lamp" aria-hidden="true"></span>
      <span class="banner-title">${i.title}</span>
      <span class="banner-detail">${i.detail}</span>
    </div>`).join('');
}

function paintStatus(stale) {
  const verdict = latest?.verdict;
  let tone = verdict?.status ?? 'unknown';
  let label = verdict?.label ?? 'Checking';

  if (stale && tone !== 'alarm') {
    tone = 'warn';
    label = 'Trouble';
  }

  setTone(statusEl, tone);
  statusEl.querySelector('[data-field="label"]').textContent = label;
  statusEl.querySelector('[data-field="age"]').textContent =
    ageText(lastSuccess === null ? null : Date.now() - lastSuccess);
}

function repaint() {
  const stale = lastSuccess === null || Date.now() - lastSuccess > STALE_AFTER;
  paintTiles(stale, focusArtifact ? focusTones(latest?.verdict) : latest?.verdict?.roleTones);
  paintArtifacts(latest?.verdict);
  paintControls();
  paintBanners(latest?.verdict, latest?.error, latest?.online);
  paintStatus(stale);
}

async function poll() {
  try {
    const res = await fetch('/api/readings');
    if (res.status === 401 || res.redirected) return location.assign('/login');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    latest = await res.json();
    if (latest.values) history.pushAll(latest.values, latest.at);
    lastSuccess = Date.now();
    failures = 0;
  } catch {
    failures += 1;
    latest = {
      ...latest,
      error: { message: 'Lost contact with the CARE server. Is it still running?' },
    };
  }

  repaint();
  setTimeout(poll, failures ? Math.min(pollMs * 2 ** failures, MAX_BACKOFF_MS) : pollMs);
}

// Keeps the "updated Ns ago" counter honest between polls.
setInterval(() => paintStatus(lastSuccess === null || Date.now() - lastSuccess > STALE_AFTER), 1000);

buildGrid();
repaint();
poll();
