// AI-Powered Automation Platform - Express server.
// Serves the API, the WhatsApp webhook, the scheduler, and (in production)
// the built React client from ../client/dist so it deploys as ONE service.
try { require('dotenv').config(); } catch { /* dotenv optional - env vars can be set directly */ }
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db, save, id } = require('./db');
const { hashPassword, verifyPassword, signToken, authRequired, adminRequired, maskCredentials } = require('./auth');
const { parseCommand } = require('./parser');
const { runAutomation } = require('./engine');
const { schedulerTick, computeNextRun, startScheduler } = require('./scheduler');
const { INTEGRATIONS } = require('./templates');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function publicUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }; }
function publicAutomation(a) { return { ...a, nextRun: a.trigger && a.trigger.type === 'schedule' ? computeNextRun(a) : (a.nextRun || null) }; }

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email and a password of at least 8 characters are required.' });
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
  const isFirst = db.users.length === 0;
  const user = { id: id('usr'), name, email, passwordHash: hashPassword(password), role: isFirst ? 'admin' : 'user', createdAt: new Date().toISOString() };
  db.users.push(user); save();
  res.status(201).json({ token: signToken(user), user: publicUser(user), note: isFirst ? 'First registered user - this account is the platform admin.' : undefined });
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) return res.status(404).json({ error: 'This account is not created. Please sign up first.' });
  if (!verifyPassword(password || '', user.passwordHash)) return res.status(401).json({ error: 'Incorrect password.' });
  res.json({ token: signToken(user), user: publicUser(user) });
});
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account with this email.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.resetCodes = db.resetCodes.filter((r) => r.userId !== user.id);
  db.resetCodes.push({ userId: user.id, code, expiresAt: Date.now() + 15 * 60000 }); save();
  console.log(`[demo] Password reset code for ${email}: ${code}`);
  // DEMO MODE: no email provider is configured, so the code is returned in
  // the response and logged - it is labelled demo, never claimed as emailed.
  res.json({ demoMode: true, message: 'Demo mode: no email was sent. Use this reset code (also in the server log).', resetCode: code });
});
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());
  const rec = user && db.resetCodes.find((r) => r.userId === user.id && r.code === String(code) && r.expiresAt > Date.now());
  if (!rec) return res.status(400).json({ error: 'Invalid or expired reset code.' });
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  user.passwordHash = hashPassword(newPassword);
  db.resetCodes = db.resetCodes.filter((r) => r.userId !== user.id); save();
  res.json({ ok: true });
});
app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', authRequired, (req, res) => {
  const autos = db.automations;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayExecs = db.executions.filter((e) => e.startedAt.slice(0, 10) === key);
    days.push({ date: key, success: dayExecs.filter((e) => e.status === 'success').length, failed: dayExecs.filter((e) => e.status === 'failed' || e.status === 'partial').length, total: dayExecs.length });
  }
  res.json({
    totalAutomations: autos.length,
    activeAutomations: autos.filter((a) => a.status === 'active').length,
    pausedAutomations: autos.filter((a) => a.status === 'paused').length,
    successfulExecutions: db.executions.filter((e) => e.status === 'success').length,
    failedExecutions: db.executions.filter((e) => e.status === 'failed' || e.status === 'partial').length,
    recentActivity: db.executions.slice(0, 8),
    performance: days,
  });
});

// ---------- AI Command Center ----------
app.post('/api/commands/parse', authRequired, async (req, res) => {
  const { command } = req.body || {};
  if (!command || command.trim().length < 8) return res.status(400).json({ error: 'Please write a longer command describing what to automate.' });
  const { draft, parserSource } = await parseCommand(command);
  res.json({ draft, parserSource, note: 'Draft only - nothing is saved until you approve it by creating the automation.' });
});

// ---------- Automations ----------
app.get('/api/automations', authRequired, (req, res) => res.json({ automations: db.automations.map(publicAutomation) }));
app.post('/api/automations', authRequired, (req, res) => {
  const { name, description, trigger, steps, retryLimit, activate } = req.body || {};
  if (!name || !trigger || !Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: 'Name, trigger and at least one step are required.' });
  const automation = { id: id('auto'), name, description: description || '', trigger, steps, status: activate ? 'active' : 'draft', retryLimit: retryLimit ?? db.settings.defaultRetryLimit ?? 2, successCount: 0, failureCount: 0, lastRun: null, nextRun: null, createdAt: new Date().toISOString(), ownerId: req.user.sub };
  automation.nextRun = automation.trigger.type === 'schedule' ? computeNextRun(automation) : null;
  db.automations.unshift(automation); save();
  res.status(201).json({ automation: publicAutomation(automation) });
});
app.put('/api/automations/:id', authRequired, (req, res) => {
  const a = db.automations.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Automation not found.' });
  for (const k of ['name', 'description', 'trigger', 'steps', 'retryLimit']) if (req.body[k] !== undefined) a[k] = req.body[k];
  a.nextRun = a.trigger && a.trigger.type === 'schedule' ? computeNextRun(a) : null;
  save(); res.json({ automation: publicAutomation(a) });
});
app.delete('/api/automations/:id', authRequired, (req, res) => {
  const idx = db.automations.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Automation not found.' });
  db.automations.splice(idx, 1); save(); res.json({ ok: true });
});
app.post('/api/automations/:id/duplicate', authRequired, (req, res) => {
  const a = db.automations.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Automation not found.' });
  const copy = { ...JSON.parse(JSON.stringify(a)), id: id('auto'), name: a.name + ' (copy)', status: 'draft', successCount: 0, failureCount: 0, lastRun: null, createdAt: new Date().toISOString() };
  db.automations.unshift(copy); save(); res.status(201).json({ automation: publicAutomation(copy) });
});
app.post('/api/automations/:id/status', authRequired, (req, res) => {
  const a = db.automations.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Automation not found.' });
  const map = { activate: 'active', pause: 'paused', resume: 'active', draft: 'draft' };
  if (!map[req.body.action]) return res.status(400).json({ error: 'Action must be activate, pause, resume or draft.' });
  a.status = map[req.body.action]; save(); res.json({ automation: publicAutomation(a) });
});
app.post('/api/automations/:id/run', authRequired, async (req, res) => {
  const a = db.automations.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Automation not found.' });
  const payload = req.body.payload || { name: 'Test Customer', email: 'test@example.com', orderId: 'ORD-1001', amount: 2500, paymentStatus: 'paid', message: 'Hello, what is the price?' };
  const execution = await runAutomation(a, payload, { type: 'manual', label: 'Manual run from dashboard' });
  res.json({ execution });
});
// Test/demo helper: force a scheduler check now (also runs every minute).
app.post('/api/scheduler/tick', authRequired, async (req, res) => res.json({ ran: await schedulerTick() }));

// ---------- Executions ----------
app.get('/api/executions', authRequired, (req, res) => {
  const list = req.query.automationId ? db.executions.filter((e) => e.automationId === req.query.automationId) : db.executions;
  res.json({ executions: list });
});
app.get('/api/executions/:id', authRequired, (req, res) => {
  const e = db.executions.find((x) => x.id === req.params.id);
  if (!e) return res.status(404).json({ error: 'Execution not found.' });
  res.json({ execution: e });
});
app.get('/api/records', authRequired, (req, res) => res.json({ records: db.records }));

// ---------- Templates ----------
app.get('/api/templates', authRequired, (req, res) => res.json({ templates: db.templates }));
app.post('/api/templates/:id/use', authRequired, (req, res) => {
  const t = db.templates.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found.' });
  const automation = { id: id('auto'), name: t.name, description: t.description, trigger: JSON.parse(JSON.stringify(t.trigger)), steps: JSON.parse(JSON.stringify(t.steps)), status: 'draft', retryLimit: 2, successCount: 0, failureCount: 0, lastRun: null, nextRun: null, createdAt: new Date().toISOString(), ownerId: req.user.sub };
  automation.nextRun = automation.trigger.type === 'schedule' ? computeNextRun(automation) : null;
  db.automations.unshift(automation); save();
  res.status(201).json({ automation: publicAutomation(automation) });
});

// ---------- Integrations ----------
app.get('/api/integrations', authRequired, (req, res) => {
  const list = INTEGRATIONS.map((meta) => {
    const state = db.integrations.find((i) => i.id === meta.id) || { connected: false, enabled: true, credentials: null, lastError: null };
    return { ...meta, connected: !!state.connected, enabled: state.enabled !== false, credentialsMasked: maskCredentials(state.credentials), lastError: state.lastError || null, connectedAt: state.connectedAt || null };
  });
  res.json({ integrations: list });
});
async function verifyIntegration(meta, creds) {
  const need = meta.fields.filter((f) => !/optional/i.test(f.label)).map((f) => f.key);
  for (const k of need) if (!creds[k]) return { ok: false, error: `Missing required credential: ${k}` };
  try {
    if (meta.verify === 'telegram') {
      const r = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`);
      const d = await r.json().catch(() => ({}));
      if (!d.ok) return { ok: false, error: 'Telegram verification failed: ' + (d.description || 'invalid bot token') };
      return { ok: true, detail: 'Bot verified: @' + (d.result && d.result.username) };
    }
    if (meta.verify === 'webhook') {
      const r = await fetch(creds.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta.id === 'discord' ? { content: 'Automation Platform: connection test' } : { text: 'Automation Platform: connection test' }) });
      if (!r.ok) return { ok: false, error: `Webhook verification failed: HTTP ${r.status}` };
      return { ok: true, detail: 'Webhook responded successfully.' };
    }
    if (meta.verify === 'whatsapp') {
      const r = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}?access_token=${encodeURIComponent(creds.accessToken)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: 'WhatsApp verification failed: ' + (d.error && d.error.message ? d.error.message : r.status) };
      return { ok: true, detail: 'WhatsApp number verified: ' + (d.display_phone_number || creds.phoneNumberId) };
    }
  } catch (e) { return { ok: false, error: 'Verification request failed: ' + e.message }; }
  return { ok: true, detail: 'Credentials saved after field validation (this provider has no public verification endpoint).' };
}
app.post('/api/integrations/:id/connect', authRequired, async (req, res) => {
  const meta = INTEGRATIONS.find((i) => i.id === req.params.id);
  if (!meta) return res.status(404).json({ error: 'Integration not found.' });
  let state = db.integrations.find((i) => i.id === meta.id);
  if (!state) { state = { id: meta.id, enabled: true, connected: false, credentials: null, lastError: null, connectedAt: null }; db.integrations.push(state); }
  const result = await verifyIntegration(meta, req.body.credentials || {});
  if (!result.ok) { state.connected = false; state.lastError = result.error; save(); return res.status(400).json({ error: result.error }); }
  state.connected = true; state.credentials = req.body.credentials; state.lastError = null; state.connectedAt = new Date().toISOString(); save();
  res.json({ ok: true, detail: result.detail });
});
app.post('/api/integrations/:id/disconnect', authRequired, (req, res) => {
  const state = db.integrations.find((i) => i.id === req.params.id);
  if (state) { state.connected = false; state.credentials = null; state.connectedAt = null; save(); }
  res.json({ ok: true });
});

// ---------- Settings ----------
app.get('/api/settings', authRequired, (req, res) => res.json({ settings: db.settings }));
app.put('/api/settings', authRequired, (req, res) => {
  for (const k of ['platformName', 'whatsappVerifyToken', 'defaultRetryLimit']) if (req.body[k] !== undefined) db.settings[k] = req.body[k];
  save(); res.json({ settings: db.settings });
});

// ---------- Admin ----------
app.get('/api/admin/overview', authRequired, adminRequired, (req, res) => {
  res.json({
    users: db.users.map(publicUser),
    automations: db.automations.map(publicAutomation),
    executions: db.executions.slice(0, 50),
    errors: db.executions.filter((e) => e.error).slice(0, 20),
    integrations: db.integrations,
    totals: { users: db.users.length, automations: db.automations.length, executions: db.executions.length, records: db.records.length },
  });
});
app.post('/api/admin/users/:id/role', authRequired, adminRequired, (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  u.role = req.body.role === 'admin' ? 'admin' : 'user'; save(); res.json({ user: publicUser(u) });
});
app.delete('/api/admin/users/:id', authRequired, adminRequired, (req, res) => {
  db.users = db.users.filter((x) => x.id !== req.params.id); save(); res.json({ ok: true });
});
app.post('/api/admin/integrations/:id/enabled', authRequired, adminRequired, (req, res) => {
  const state = db.integrations.find((i) => i.id === req.params.id);
  if (!state) return res.status(404).json({ error: 'Integration not found.' });
  state.enabled = !!req.body.enabled; save(); res.json({ ok: true, enabled: state.enabled });
});

// ---------- Webhooks (public, provider-facing) ----------
// Meta verification handshake.
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'], token = req.query['hub.verify_token'], challenge = req.query['hub.challenge'];
  const expected = db.settings.whatsappVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === 'subscribe' && token === expected) return res.status(200).send(challenge);
  return res.status(403).send('Verification token mismatch');
});
// Incoming WhatsApp message -> run matching active whatsapp_message automations.
app.post('/webhook/whatsapp', async (req, res) => {
  let from = null, messageText = '';
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg) { from = msg.from; messageText = msg.text?.body || ''; }
  } catch { /* fall through to simple payload */ }
  if (!from && (req.body.from || req.body.phone)) { from = req.body.from || req.body.phone; messageText = req.body.message || req.body.text || req.body.body || ''; }
  if (!from) return res.status(400).json({ error: 'No incoming message found in payload.' });
  const payload = { from, phone: from, message: messageText, name: 'WhatsApp Customer' };
  const matched = db.automations.filter((a) => a.status === 'active' && a.trigger && a.trigger.type === 'whatsapp_message' && (!(a.trigger.config && a.trigger.config.keyword) || messageText.toLowerCase().includes(String(a.trigger.config.keyword).toLowerCase())));
  const results = [];
  for (const a of matched) { const exec = await runAutomation(a, payload, a.trigger); results.push({ automationId: a.id, executionId: exec.id, status: exec.status }); }
  res.json({ received: true, matched: matched.length, results });
});
// Generic external trigger for one automation.
app.post('/webhook/:automationId', async (req, res) => {
  const a = db.automations.find((x) => x.id === req.params.automationId);
  if (!a) return res.status(404).json({ error: 'Automation not found.' });
  if (a.status !== 'active') return res.status(409).json({ error: 'Automation is not active.' });
  const exec = await runAutomation(a, req.body || {}, a.trigger);
  res.json({ executionId: exec.id, status: exec.status });
});

app.get('/api/health', (req, res) => res.json({ ok: true, users: db.users.length, automations: db.automations.length }));

// Serve the built client (production / Render single-service deploy).
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => { if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next(); res.sendFile(path.join(dist, 'index.html')); });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log(`Automation Platform server running on http://localhost:${PORT}`); startScheduler(); });
module.exports = app;
