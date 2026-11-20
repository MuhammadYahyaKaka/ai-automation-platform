// Authentication helpers: scrypt password hashing (Node crypto, no native
// dependencies) and a small HMAC-signed token in JWT format.
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}
function b64(obj) { return Buffer.from(JSON.stringify(obj)).toString('base64url'); }
function signToken(user) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ sub: user.id, email: user.email, role: user.role, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const data = header + '.' + payload;
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return data + '.' + sig;
}
function verifyToken(token) {
  try {
    const [header, payload, sig] = token.split('.');
    const data = header + '.' + payload;
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch { return null; }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const decoded = token && verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Authentication required. Please log in.' });
  req.user = decoded;
  next();
}
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
  next();
}

function maskCredentials(creds) {
  if (!creds) return null;
  const masked = {};
  for (const [k, v] of Object.entries(creds)) {
    if (!v) { masked[k] = ''; continue; }
    masked[k] = v.length <= 4 ? '••••' : '••••••••' + v.slice(-2);
  }
  return masked;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, authRequired, adminRequired, maskCredentials };
