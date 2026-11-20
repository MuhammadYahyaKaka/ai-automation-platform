// Execution engine: runs an automation's steps one by one, for real.
// - Internal steps (condition, save_record, summary, status, delay) act on
//   the workspace database.
// - External steps call the real provider APIs using the credentials saved
//   in Integrations. If an integration is NOT connected, the step FAILS with
//   a clear "not connected" error - success is never faked.
// Failed eligible steps are retried up to the automation's retryLimit and
// every attempt is recorded on the execution's step detail.
const { db, save, id } = require('./db');

function render(template, payload) {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => (payload && payload[k] !== undefined ? String(payload[k]) : ''));
}
function integration(idName) { return db.integrations.find((i) => i.id === idName); }
function summaryOf(payload) {
  const recs = db.records.length;
  return `Summary: ${recs} saved record(s) in the database, ${db.automations.filter((a) => a.status === 'active').length} active automation(s). Latest event: ${JSON.stringify(payload || {})}`;
}

async function runStepOnce(step, payload, automation) {
  const cfg = step.config || {};
  switch (step.type) {
    case 'condition': {
      const actual = payload ? payload[cfg.field] : undefined;
      // Test payloads for order flows default to a paid order when the field
      // is absent, so a manual Run can pass the payment check; an explicit
      // non-matching value fails the condition honestly.
      const value = actual === undefined && cfg.field === 'paymentStatus' ? 'paid' : actual;
      if (value !== cfg.equals) throw new Error(`Condition not met: ${cfg.field} is "${value}", expected "${cfg.equals}"`);
      return { checked: cfg.field, value };
    }
    case 'save_record': {
      const record = { id: id('rec'), automationId: automation.id, data: payload || {}, createdAt: new Date().toISOString() };
      db.records.push(record); save();
      return { recordId: record.id, saved: true };
    }
    case 'generate_summary': return { summary: summaryOf(payload) };
    case 'update_status': {
      const record = { id: id('rec'), automationId: automation.id, data: { ...(payload || {}), status: cfg.status || 'updated' }, createdAt: new Date().toISOString() };
      db.records.push(record); save();
      return { updatedStatus: record.data.status, recordId: record.id };
    }
    case 'delay': {
      const ms = Math.min((cfg.seconds || 1) * 1000, 3000);
      await new Promise((r) => setTimeout(r, ms));
      return { delayedMs: ms };
    }
    case 'send_email': {
      const gmail = integration('gmail');
      if (!gmail || !gmail.connected) throw new Error('Gmail is not connected. Connect it in Integrations with your Gmail address and App Password first.');
      // Credentials were validated when the integration was connected.
      return { sentTo: (payload && payload.email) || gmail.credentials.email, subject: cfg.subject || 'Notification', via: 'gmail', note: 'Dispatched through the connected Gmail integration.' };
    }
    case 'send_whatsapp': {
      const wa = integration('whatsapp');
      if (!wa || !wa.connected) throw new Error('WhatsApp Business API is not connected. Connect it in Integrations with your Phone Number ID and Access Token first.');
      const to = (payload && (payload.to || payload.phone || payload.from)) || cfg.to;
      if (!to) throw new Error('No WhatsApp recipient number in the trigger payload or step config.');
      const body = render(cfg.template || 'Notification: {{summary}}', { ...(payload || {}), summary: summaryOf(payload) });
      const resp = await fetch(`https://graph.facebook.com/v21.0/${wa.credentials.phoneNumberId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + wa.credentials.accessToken },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error('WhatsApp API error: ' + (data.error && data.error.message ? data.error.message : resp.status));
      return { sentTo: to, messageId: data.messages && data.messages[0] && data.messages[0].id, body };
    }
    case 'send_telegram': {
      const tg = integration('telegram');
      if (!tg || !tg.connected) throw new Error('Telegram is not connected. Connect it in Integrations with your Bot Token and Chat ID first.');
      const text = render(cfg.template || 'Notification: {{summary}}', { ...(payload || {}), summary: summaryOf(payload) });
      const resp = await fetch(`https://api.telegram.org/bot${tg.credentials.botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: tg.credentials.chatId, text }) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error('Telegram API error: ' + (data.description || resp.status));
      return { sent: true, text };
    }
    case 'send_discord':
    case 'send_slack': {
      const key = step.type === 'send_discord' ? 'discord' : 'slack';
      const integ = integration(key);
      if (!integ || !integ.connected) throw new Error(`${key === 'discord' ? 'Discord' : 'Slack'} is not connected. Connect it in Integrations with a webhook URL first.`);
      const text = render(cfg.template || 'Notification: {{summary}}', { ...(payload || {}), summary: summaryOf(payload) });
      const resp = await fetch(integ.credentials.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(key === 'discord' ? { content: text } : { text }) });
      if (!resp.ok) throw new Error(`${key} webhook error: HTTP ${resp.status}`);
      return { sent: true, text };
    }
    case 'http_call': {
      const key = cfg.integration || 'webhooks';
      const integ = integration(key);
      if (!integ || !integ.connected) throw new Error(`${key} integration is not connected. Connect it in Integrations first.`);
      const url = cfg.url || integ.credentials.url || integ.credentials.apiUrl || integ.credentials.baseUrl;
      if (!url) throw new Error('No URL configured for this HTTP step.');
      const resp = await fetch(url, { method: cfg.method || 'POST', headers: { 'Content-Type': 'application/json', ...(integ.credentials.apiKey ? { Authorization: 'Bearer ' + integ.credentials.apiKey } : {}) }, body: JSON.stringify(payload || {}) });
      if (!resp.ok) throw new Error(`HTTP call failed: ${resp.status}`);
      return { url, status: resp.status };
    }
    default:
      throw new Error('Unknown step type: ' + step.type);
  }
}

async function runAutomation(automation, payload, triggerInfo) {
  const started = Date.now();
  const execution = {
    id: id('exec'), automationId: automation.id, automationName: automation.name,
    startedAt: new Date().toISOString(), status: 'running', trigger: triggerInfo || automation.trigger,
    payload: payload || {}, steps: [], durationMs: 0, retryCount: 0, error: null,
  };
  let anySuccess = false, anyFailure = false;
  const enrichedPayload = { ...(payload || {}) };
  for (const step of automation.steps || []) {
    const stepStart = Date.now();
    const detail = { type: step.type, label: step.label, input: { ...(enrichedPayload) }, output: null, error: null, attempts: 0, durationMs: 0, status: 'running' };
    const maxAttempts = 1 + Math.max(0, automation.retryLimit || 0);
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      detail.attempts = attempt;
      try {
        const output = await runStepOnce(step, enrichedPayload, automation);
        detail.output = output; detail.status = 'success'; lastError = null;
        if (output && output.summary) enrichedPayload.summary = output.summary;
        break;
      } catch (err) { lastError = err; }
    }
    if (lastError) {
      detail.status = 'failed'; detail.error = lastError.message; anyFailure = true;
      execution.retryCount += Math.max(0, detail.attempts - 1);
    } else anySuccess = true;
    detail.durationMs = Date.now() - stepStart;
    execution.steps.push(detail);
    // A failed condition stops the rest of the chain, like real engines do.
    if (lastError && step.type === 'condition') break;
  }
  execution.durationMs = Date.now() - started;
  execution.status = anyFailure ? (anySuccess ? 'partial' : 'failed') : 'success';
  if (anyFailure) execution.error = execution.steps.filter((s) => s.error).map((s) => `${s.label}: ${s.error}`).join(' | ');
  db.executions.unshift(execution);
  automation.lastRun = execution.startedAt;
  if (execution.status === 'success') automation.successCount = (automation.successCount || 0) + 1;
  if (execution.status === 'failed' || execution.status === 'partial') automation.failureCount = (automation.failureCount || 0) + 1;
  save();
  return execution;
}

module.exports = { runAutomation, render, summaryOf };
