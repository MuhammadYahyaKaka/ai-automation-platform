// File-based JSON database at server/data/db.json.
// This is a plain file store (NOT a hosted database) - simple to run and
// inspect, suitable for a single-server deployment.
const fs = require('fs');
const path = require('path');
const { INTEGRATIONS, TEMPLATES } = require('./templates');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function seed() {
  return {
    users: [],
    automations: [],
    executions: [],
    records: [],
    integrations: INTEGRATIONS.map((i) => ({ id: i.id, enabled: true, connected: false, credentials: null, lastError: null, connectedAt: null })),
    templates: TEMPLATES,
    settings: { platformName: 'Automation Platform', whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'my-whatsapp-verify-token', defaultRetryLimit: 2, demoMode: true },
    resetCodes: [],
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    const data = seed();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return data;
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Fill any missing collections after upgrades.
  const fresh = seed();
  for (const key of Object.keys(fresh)) if (data[key] === undefined) data[key] = fresh[key];
  return data;
}

let db = load();
function save() { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function id(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

module.exports = { db, save, id, DB_PATH, seed };
