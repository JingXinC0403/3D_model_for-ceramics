import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDatabase } from './db.js';
import { sessionMiddleware } from './auth.js';
import { BOX, isMock } from './box.js';
import { authRoutes } from './routes/auth.js';
import { homeRoutes } from './routes/home.js';
import { artifactRoutes } from './routes/artifacts.js';
import { apiRoutes } from './routes/api.js';
import { controlRoutes } from './routes/controls.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

const store = openDatabase(process.env.CARE_DB ?? 'care.db');
store.purgeExpiredSessions();

const app = express();

app.set('view engine', 'ejs');
app.set('views', join(here, 'views'));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.static(join(here, '..', 'public')));
app.use(sessionMiddleware(store));

app.use('/', authRoutes(store));
app.use('/api', apiRoutes(store));
app.use('/artifacts', artifactRoutes(store));
app.use('/controls', controlRoutes());
app.use('/', homeRoutes(store));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: 'There is nothing at that address.',
  });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something broke',
    message: 'The server hit an error handling that request. Check the terminal for details.',
  });
});

app.listen(PORT, () => {
  console.log(`[care] http://localhost:${PORT}`);
  console.log(`[care] box "${BOX.name}" via ${isMock() ? 'sample data' : BOX.region}`);
});
