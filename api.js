import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { boxClient } from '../clients.js';
import { evaluateBox } from '../monitor.js';
import { normalizeReadings } from '../sensors.js';

export function apiRoutes(store) {
  const router = Router();
  router.use(requireAuth);

  router.get('/readings', async (req, res) => {
    const reading = await boxClient().readAll();
    // Invert any active-low pin before anything judges or displays it.
    const values = normalizeReadings(reading.values);

    const verdict = evaluateBox({
      artifacts: store.listArtifacts(),
      values,
      online: reading.online,
      error: reading.error,
    });

    res.json({
      at: Date.now(),
      ok: reading.ok,
      online: reading.online,
      error: reading.error,
      values,
      verdict,
    });
  });

  return router;
}
