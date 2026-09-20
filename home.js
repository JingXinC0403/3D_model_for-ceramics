import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { BOX, isMock } from '../box.js';
import { GROUPS, POLL_INTERVAL_MS, SENSORS } from '../sensors.js';

export function homeRoutes(store) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.render('home', {
      title: BOX.name,
      box: BOX,
      isMock: isMock(),
      artifacts: store.listArtifacts(),
      sensors: SENSORS,
      groups: GROUPS,
      pollMs: POLL_INTERVAL_MS,
    });
  });

  return router;
}
