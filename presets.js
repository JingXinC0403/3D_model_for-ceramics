// Starting points for an artifact's ideal range, by material.
// These are conventional museum-storage figures, not authority: every value is
// editable per artifact, and a conservator's guidance for a specific object wins.

export const PRESETS = [
  { id: 'paper',    label: 'Paper, books, documents', tempMin: 16, tempMax: 20, rhMin: 45, rhMax: 55 },
  { id: 'textile',  label: 'Textiles, fabric',        tempMin: 16, tempMax: 20, rhMin: 45, rhMax: 55 },
  { id: 'wood',     label: 'Wood, furniture',         tempMin: 18, tempMax: 22, rhMin: 45, rhMax: 60 },
  { id: 'metal',    label: 'Metal',                   tempMin: 15, tempMax: 22, rhMin: 20, rhMax: 40 },
  { id: 'ceramic',  label: 'Ceramic, glass, stone',   tempMin: 15, tempMax: 25, rhMin: 40, rhMax: 60 },
  { id: 'photo',    label: 'Photographs, film',       tempMin: 12, tempMax: 18, rhMin: 30, rhMax: 40 },
  { id: 'organic',  label: 'Bone, ivory, leather',    tempMin: 16, tempMax: 20, rhMin: 45, rhMax: 55 },
  { id: 'mixed',    label: 'Mixed or unknown',        tempMin: 18, tempMax: 22, rhMin: 45, rhMax: 55 },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) ?? null;
}
