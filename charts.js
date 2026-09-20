// Hand-rolled SVG sparklines. No chart library: a line and a fill is all this needs,
// and it keeps the app working with no network and no CDN.

/** Nulls split the line into separate segments rather than being interpolated over. */
export function buildPath(values, { width, height, pad = 3 }) {
  const present = values.filter((v) => v !== null && v !== undefined);
  if (present.length < 2) return { d: '', fill: '', min: null, max: null };

  let min = Math.min(...present);
  let max = Math.max(...present);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }

  // The line spans the full width from the first sample onward, so a freshly
  // opened page shows a chart rather than a sliver against the right edge.
  const usable = height - pad * 2;
  const xAt = (i) => (values.length > 1 ? (i / (values.length - 1)) * width : width);
  const yAt = (v) => pad + (1 - (v - min) / (max - min)) * usable;

  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (v === null || v === undefined) {
      if (current.length > 1) segments.push(current);
      current = [];
      return;
    }
    current.push([xAt(i), yAt(v)]);
  });
  if (current.length > 1) segments.push(current);
  if (!segments.length) return { d: '', fill: '', min, max };

  const d = segments
    .map((seg) => seg.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '))
    .join(' ');

  const last = segments[segments.length - 1];
  const first = segments[0];
  const fill = `${d} L${last[last.length - 1][0].toFixed(1)} ${height} L${first[0][0].toFixed(1)} ${height} Z`;

  return { d, fill, min, max };
}

export function sparkline(values, { width = 240, height = 48, tone = 'ok' } = {}) {
  const { d, fill } = buildPath(values, { width, height });
  const open = `<svg class="spark tone-${tone}" style="height:${height}px" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`;
  if (!d) return `${open}</svg>`;

  return `${open}
    <path class="spark-fill" d="${fill}"></path>
    <path class="spark-line" d="${d}"></path>
  </svg>`;
}
