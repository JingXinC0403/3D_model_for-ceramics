// The one place this site writes to the hardware.

import { Router } from 'express';
import { requireAuth, requireCsrf } from '../auth.js';
import { boxClient } from '../clients.js';
import { findControl } from '../sensors.js';

/** Only a same-origin path, so a crafted form cannot bounce the user elsewhere. */
function safeReturn(value) {
  const path = String(value ?? '');
  return /^\/[A-Za-z0-9\-._~/]*$/.test(path) ? path : '/';
}

export function controlRoutes() {
  const router = Router();
  router.use(requireAuth);

  router.post('/:pin', requireCsrf, async (req, res) => {
    // Whitelist: a pin the sensor map does not mark as a control cannot be written,
    // however the request is shaped.
    const control = findControl(req.params.pin);
    if (!control) {
      return res.status(404).render('error', {
        title: 'Not a control',
        message: 'That pin is read-only. Nothing was sent to the box.',
      });
    }

    const value = Number(req.body.value);
    if (value !== 0 && value !== 1) {
      return res.status(400).render('error', {
        title: 'Bad request',
        message: `${control.name} accepts only on or off. Nothing was sent to the box.`,
      });
    }

    const result = await boxClient().writePin(control.pin, value);
    if (!result.ok) {
      return res.status(502).render('error', {
        title: `Could not switch ${control.name.toLowerCase()}`,
        message: `${result.error.message} The box was not changed.`,
      });
    }

    res.redirect(safeReturn(req.body.return));
  });

  return router;
}
