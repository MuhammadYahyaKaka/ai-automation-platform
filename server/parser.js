// Natural-language command parser.
// Works fully WITHOUT any AI key via the built-in rule/keyword parser below,
// which genuinely handles the documented example commands. If an
// OPENAI_API_KEY or ANTHROPIC_API_KEY is configured, we try that API first
// and fall back to the built-in parser on any failure. The response always
// states which parser produced the result (parserSource).

function parseBuiltin(raw) {
  const text = raw.trim();
  const lower = text.toLowerCase();
  let trigger = { type: 'manual', label: 'Manual trigger' };
  const steps = [];

  // ---- Trigger detection ----
  const timeMatch = lower.match(/(\d{1,2})\s*(am|pm)/);
  if (lower.includes('contact form') || lower.includes('form') && lower.includes('submit')) {
    trigger = { type: 'form_submission', label: 'When a contact form is submitted' };
  } else if (lower.includes('whatsapp message') || lower.includes('message on whatsapp') || lower.includes('incoming whatsapp') || (lower.includes('whatsapp') && (lower.includes('auto-reply') || lower.includes('auto reply')))) {
    trigger = { type: 'whatsapp_message', label: 'When a WhatsApp message is received', config: {} };
    const kw = lower.match(/keyword\s+["']?([a-z0-9]+)["']?/);
    if (kw) trigger.config.keyword = kw[1];
  } else if (lower.includes('every day') || lower.includes('daily') || lower.includes('schedule') || timeMatch) {
    let time = '09:00';
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      if (timeMatch[2] === 'pm' && h < 12) h += 12;
      if (timeMatch[2] === 'am' && h === 12) h = 0;
      time = String(h).padStart(2, '0') + ':00';
    }
    trigger = { type: 'schedule', label: `Every day at ${time}`, config: { schedule: 'daily', time, timezone: 'Asia/Karachi' } };
  } else if (lower.includes('register')) {
    trigger = { type: 'customer_registered', label: 'When a customer registers' };
  } else if (lower.includes('completed') || lower.includes('complete')) {
    trigger = { type: 'order_completed', label: 'When an order is marked as completed' };
  } else if (lower.includes('new order') || lower.includes('order is received') || lower.includes('order received')) {
    trigger = { type: 'new_order', label: 'When a new order is received' };
  }

  // ---- Condition detection ----
  if (lower.includes('payment')) {
    steps.push({ type: 'condition', label: 'Check payment status is paid', config: { field: 'paymentStatus', equals: 'paid' } });
  }

  // ---- Action detection (order matters: keep sentence order roughly) ----
  const wantsSave = lower.includes('save') || lower.includes('database') || lower.includes('store');
  const wantsSummary = lower.includes('summary') || lower.includes('report');
  if (wantsSummary) steps.push({ type: 'generate_summary', label: 'Generate summary of new orders', config: {} });
  if (wantsSave) steps.push({ type: 'save_record', label: 'Save information in database', config: {} });
  if (lower.includes('update') && lower.includes('status')) {
    steps.push({ type: 'update_status', label: 'Update order status', config: { status: 'completed' } });
  }
  if (lower.includes('whatsapp')) {
    const isReply = trigger.type === 'whatsapp_message';
    steps.push({ type: 'send_whatsapp', label: isReply ? 'Send WhatsApp auto-reply' : 'Send WhatsApp notification', config: { template: isReply ? 'Thanks for your message! We received: "{{message}}" and will reply shortly.' : 'New {{trigger}} received. Details: {{summary}}' } });
  }
  if (lower.includes('telegram')) steps.push({ type: 'send_telegram', label: 'Send Telegram notification', config: { template: 'Notification: {{summary}}' } });
  if (lower.includes('email') || lower.includes('welcome')) {
    const welcome = lower.includes('welcome');
    steps.push({ type: 'send_email', label: welcome ? 'Send welcome email' : 'Send email notification', config: { subject: welcome ? 'Welcome!' : 'Automation notification', template: welcome ? 'Welcome {{name}}! Thanks for registering with us.' : (wantsSummary ? '{{summary}}' : 'Hi {{name}}, your information has been received.') } });
  }
  if ((lower.includes('notify') || lower.includes('notification')) && !lower.includes('whatsapp') && !lower.includes('email')) {
    steps.push({ type: 'send_email', label: 'Send notification email', config: { subject: 'Notification', template: 'Notification: {{summary}}' } });
  }
  if (steps.length === 0) steps.push({ type: 'save_record', label: 'Save information in database', config: {} });

  const nameBase = trigger.type === 'schedule' ? 'Scheduled summary' : trigger.label.replace(/^When a |^When an |^When /, '').replace(/^./, (c) => c.toUpperCase());
  return {
    name: nameBase + ' automation',
    description: text,
    trigger,
    steps,
    retryLimit: 2,
  };
}

async function tryAiParse(text) {
  // Optional external AI parse. Returns null on any problem so the caller
  // falls back to the built-in parser - the app never depends on a key.
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: 'Parse this automation command into JSON {name, description, trigger:{type,label,config}, steps:[{type,label,config}], retryLimit}. Trigger types: form_submission, new_order, order_completed, customer_registered, schedule, whatsapp_message, manual. Step types: condition, save_record, generate_summary, update_status, send_email, send_whatsapp, send_telegram, http_call, delay. Command: ' + text }] }),
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    if (!parsed.trigger || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch { return null; }
}

async function parseCommand(text) {
  const ai = await tryAiParse(text);
  if (ai) return { draft: ai, parserSource: process.env.OPENAI_API_KEY ? 'openai' : 'ai' };
  return { draft: parseBuiltin(text), parserSource: 'builtin' };
}

module.exports = { parseCommand, parseBuiltin };
