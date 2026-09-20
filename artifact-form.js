// Fill the ideal ranges from the chosen material. Values stay editable afterwards.

import { readJson } from './view.js';

const presets = readJson('presets') ?? [];
const material = document.getElementById('material');

material?.addEventListener('change', () => {
  const preset = presets.find((p) => p.id === material.value);
  if (!preset) return;

  document.getElementById('tempMin').value = preset.tempMin;
  document.getElementById('tempMax').value = preset.tempMax;
  document.getElementById('rhMin').value = preset.rhMin;
  document.getElementById('rhMax').value = preset.rhMax;
});
