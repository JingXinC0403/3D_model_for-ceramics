// Fixed-size rolling buffer per pin. Nulls are stored, not dropped —
// a gap in the data should look like a gap.

export function createHistory(pins, size = 150) {
  const store = new Map(pins.map((pin) => [pin, []]));

  function push(pin, value, t = Date.now()) {
    const buf = store.get(pin);
    if (!buf) return;
    buf.push({ t, v: value });
    if (buf.length > size) buf.splice(0, buf.length - size);
  }

  return {
    push,
    pushAll(values, t = Date.now()) {
      for (const pin of pins) push(pin, values?.[pin] ?? null, t);
    },
    values: (pin) => (store.get(pin) ?? []).map((s) => s.v),
    latest(pin) {
      const buf = store.get(pin);
      return buf?.length ? buf[buf.length - 1] : null;
    },
  };
}
