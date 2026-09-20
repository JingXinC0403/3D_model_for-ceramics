import { Router } from 'express';
import { requireAuth, requireCsrf } from '../auth.js';
import { PRESETS, presetById } from '../presets.js';
import { BOX, isMock } from '../box.js';
import { CONTROLS, GROUPS, POLL_INTERVAL_MS, SENSORS } from '../sensors.js';

function readForm(body) {
  const num = (v) => (String(v ?? '').trim() === '' ? NaN : Number(v));
  return {
    name: String(body.name ?? '').trim(),
    material: String(body.material ?? '').trim(),
    notes: String(body.notes ?? '').trim().slice(0, 2000),
    tempMin: num(body.tempMin),
    tempMax: num(body.tempMax),
    rhMin: num(body.rhMin),
    rhMax: num(body.rhMax),
  };
}

function validate(a) {
  if (!a.name) return 'Give the artifact a name.';
  if (a.name.length > 120) return 'That name is too long.';
  if (!presetById(a.material)) return 'Choose a material.';

  for (const [key, label] of [['tempMin', 'minimum temperature'], ['tempMax', 'maximum temperature'],
    ['rhMin', 'minimum humidity'], ['rhMax', 'maximum humidity']]) {
    if (!Number.isFinite(a[key])) return `Enter a number for ${label}.`;
  }

  if (a.tempMin >= a.tempMax) return 'Minimum temperature must be below the maximum.';
  if (a.rhMin >= a.rhMax) return 'Minimum humidity must be below the maximum.';
  if (a.rhMin < 0 || a.rhMax > 100) return 'Humidity limits must sit between 0 and 100%.';
  return null;
}

/** The DB row shape the form maps onto, used when re-rendering after an error. */
const toRow = (a, id = null) => ({
  id, name: a.name, material: a.material, notes: a.notes,
  temp_min: a.tempMin, temp_max: a.tempMax, rh_min: a.rhMin, rh_max: a.rhMax,
});

export function artifactRoutes(store) {
  const router = Router();
  router.use(requireAuth);

  function notFound(res) {
    return res.status(404).render('error', {
      title: 'Artifact not found',
      message: 'That artifact is not recorded in the box.',
    });
  }

  router.get('/new', (req, res) => {
    res.render('artifact-form', {
      title: 'Record an artifact',
      presets: PRESETS,
      error: null,
      artifact: toRow({
        name: '', material: 'mixed', notes: '',
        tempMin: 18, tempMax: 22, rhMin: 45, rhMax: 55,
      }),
    });
  });

  router.post('/', requireCsrf, (req, res) => {
    const form = readForm(req.body);
    const error = validate(form);
    if (error) {
      return res.status(400).render('artifact-form', {
        title: 'Record an artifact', presets: PRESETS, error, artifact: toRow(form),
      });
    }

    store.createArtifact(form);
    res.redirect('/');
  });

  router.get('/:artifactId', (req, res) => {
    const artifact = store.findArtifact(req.params.artifactId);
    if (!artifact) return notFound(res);

    res.render('artifact', {
      title: artifact.name,
      box: BOX,
      isMock: isMock(),
      artifact,
      material: presetById(artifact.material),
      sensors: SENSORS,
      groups: GROUPS,
      controls: CONTROLS,
      pollMs: POLL_INTERVAL_MS,
    });
  });

  router.get('/:artifactId/edit', (req, res) => {
    const artifact = store.findArtifact(req.params.artifactId);
    if (!artifact) return notFound(res);

    res.render('artifact-form', {
      title: `Edit ${artifact.name}`, presets: PRESETS, error: null, artifact,
    });
  });

  router.post('/:artifactId', requireCsrf, (req, res) => {
    const existing = store.findArtifact(req.params.artifactId);
    if (!existing) return notFound(res);

    const form = readForm(req.body);
    const error = validate(form);
    if (error) {
      return res.status(400).render('artifact-form', {
        title: `Edit ${existing.name}`, presets: PRESETS, error,
        artifact: toRow(form, existing.id),
      });
    }

    store.updateArtifact(existing.id, form);
    res.redirect('/');
  });

  router.post('/:artifactId/delete', requireCsrf, (req, res) => {
    store.deleteArtifact(req.params.artifactId);
    res.redirect('/');
  });

  return router;
}
