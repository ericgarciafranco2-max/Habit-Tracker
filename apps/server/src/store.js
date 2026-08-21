import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Almacen en ficheros JSON. Para un tracker personal (una persona, dos o tres
 * dispositivos) una base de datos es peso muerto: un fichero por usuario es
 * suficiente, se lee entero, se escribe de forma atomica y se puede copiar
 * con un `cp` si quieres backup.
 */
export class Store {
  constructor(dir) {
    this.dir = dir;
    this.usersFile = path.join(dir, 'users.json');
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    if (!fs.existsSync(this.usersFile)) this.#writeJson(this.usersFile, { users: [] });
  }

  #readJson(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  #writeJson(file, data) {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 0));
    fs.renameSync(tmp, file);
  }

  listUsers() {
    return this.#readJson(this.usersFile, { users: [] }).users ?? [];
  }

  findUser(email) {
    const norm = String(email || '').trim().toLowerCase();
    return this.listUsers().find((u) => u.email === norm);
  }

  createUser(email, password) {
    const norm = String(email || '').trim().toLowerCase();
    if (this.findUser(norm)) throw new Error('El usuario ya existe');
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const user = {
      id: crypto.randomUUID(),
      email: norm,
      salt,
      hash,
      createdAt: Date.now(),
    };
    const users = this.listUsers();
    users.push(user);
    this.#writeJson(this.usersFile, { users });
    return user;
  }

  verify(email, password) {
    const user = this.findUser(email);
    if (!user) return null;
    const hash = crypto.scryptSync(password, user.salt, 64);
    const known = Buffer.from(user.hash, 'hex');
    if (hash.length !== known.length || !crypto.timingSafeEqual(hash, known)) return null;
    return user;
  }

  docFile(userId) {
    return path.join(this.dir, 'docs', `${userId}.json`);
  }

  readDoc(userId) {
    return this.#readJson(this.docFile(userId), null);
  }

  writeDoc(userId, doc) {
    this.#writeJson(this.docFile(userId), doc);
  }
}

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;

export function signToken(secret, userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data.sub;
  } catch {
    return null;
  }
}

/** Secreto persistente: se genera solo la primera vez y se guarda en disco. */
export function loadSecret(dir) {
  if (process.env.HABIT_SECRET) return process.env.HABIT_SECRET;
  const file = path.join(dir, 'secret.txt');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
