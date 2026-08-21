import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mergeDocs, ensureDoc, compact } from '@habit/core';
import { Store, signToken, verifyToken, loadSecret } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.HABIT_DATA_DIR
  ? path.resolve(process.env.HABIT_DATA_DIR)
  : path.join(ROOT, 'apps/server/data');
const PORT = Number(process.env.PORT || 4321);
const WEB_DIST = path.join(ROOT, 'apps/web/dist');

const store = new Store(DATA_DIR);
const SECRET = loadSecret(DATA_DIR);

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = verifyToken(SECRET, token);
  if (!userId) return res.status(401).json({ error: 'Sesion no valida' });
  req.userId = userId;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'habit-tracker-sync', version: 1, users: store.listUsers().length });
});

app.post('/api/register', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Email y contrasena de 6+ caracteres' });
  }
  try {
    const user = store.createUser(email, password);
    res.json({ token: signToken(SECRET, user.id), email: user.email });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = store.verify(email, password);
  if (!user) return res.status(401).json({ error: 'Email o contrasena incorrectos' });
  res.json({ token: signToken(SECRET, user.id), email: user.email });
});

app.get('/api/doc', auth, (req, res) => {
  const doc = store.readDoc(req.userId);
  res.json({ doc, serverTime: Date.now() });
});

/**
 * Sincronizacion: el cliente envia su documento completo, el servidor lo
 * mezcla con el que tiene guardado (gana el registro mas reciente) y devuelve
 * el resultado. El cliente adopta la respuesta. Con esto, marcar habitos sin
 * cobertura en el movil y luego abrir el PC converge sin perder nada.
 */
app.post('/api/sync', auth, (req, res) => {
  const incoming = req.body?.doc;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Falta el documento' });
  }
  const stored = store.readDoc(req.userId);
  const merged = compact(stored ? mergeDocs(stored, incoming) : ensureDoc(incoming));
  store.writeDoc(req.userId, merged);
  res.json({ doc: merged, serverTime: Date.now() });
});

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .type('text/plain')
      .send('Servidor de sincronizacion activo. Compila la web con "npm run build" para servirla desde aqui.'),
  );
}

app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets)
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`\n  Habit Tracker — servidor de sincronizacion`);
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  Red:     http://${ip}:${PORT}   <- usa esta en el movil`);
  console.log(`  Datos:   ${DATA_DIR}\n`);
});
