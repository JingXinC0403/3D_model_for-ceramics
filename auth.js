import { Router } from 'express';
import {
  SESSION_TTL_MS, clearSessionCookie, hashPassword, newCsrfToken,
  readCookie, setSessionCookie, validateCredentials, verifyPassword,
} from '../auth.js';

// Slows down guessing without needing a dependency. Per email, in memory.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map();

function tooManyAttempts(email) {
  const record = attempts.get(email);
  if (!record) return false;
  if (Date.now() - record.first > ATTEMPT_WINDOW_MS) {
    attempts.delete(email);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function noteFailure(email) {
  const record = attempts.get(email);
  if (!record || Date.now() - record.first > ATTEMPT_WINDOW_MS) {
    attempts.set(email, { first: Date.now(), count: 1 });
    return;
  }
  record.count += 1;
}

export function authRoutes(store) {
  const router = Router();

  async function startSession(res, userId) {
    const csrf = newCsrfToken();
    const id = store.createSession(userId, csrf, SESSION_TTL_MS);
    setSessionCookie(res, id);
  }

  router.get('/signup', (req, res) => {
    if (req.user) return res.redirect('/');
    res.render('signup', { title: 'Create an account', error: null, email: '' });
  });

  router.post('/signup', async (req, res) => {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');

    const invalid = validateCredentials(email, password);
    if (invalid) {
      return res.status(400).render('signup', { title: 'Create an account', error: invalid, email });
    }

    if (store.findUserByEmail(email)) {
      return res.status(409).render('signup', {
        title: 'Create an account',
        error: 'An account already exists for that email. Sign in instead.',
        email,
      });
    }

    const user = store.createUser(email, await hashPassword(password));
    await startSession(res, user.id);
    res.redirect('/');
  });

  router.get('/login', (req, res) => {
    if (req.user) return res.redirect('/');
    res.render('login', { title: 'Sign in', error: null, email: '' });
  });

  router.post('/login', async (req, res) => {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');

    if (tooManyAttempts(email)) {
      return res.status(429).render('login', {
        title: 'Sign in',
        error: 'Too many failed attempts. Wait 15 minutes and try again.',
        email,
      });
    }

    const user = store.findUserByEmail(email);
    const okPassword = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !okPassword) {
      noteFailure(email);
      // Same message either way: do not reveal which emails have accounts.
      return res.status(401).render('login', {
        title: 'Sign in',
        error: 'That email and password do not match an account.',
        email,
      });
    }

    attempts.delete(email);
    await startSession(res, user.id);
    res.redirect('/');
  });

  router.post('/logout', (req, res) => {
    const id = readCookie(req);
    if (id) store.destroySession(id);
    clearSessionCookie(res);
    res.redirect('/login');
  });

  return router;
}
