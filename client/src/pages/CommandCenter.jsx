import React, { useState } from 'react';
import { api } from '../api';
import { EXAMPLE_COMMANDS } from '../constants';

export default function CommandCenter({ go }) {
  const [command, setCommand] = useState('');
  const [draft, setDraft] = useState(null); const [source, setSource] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(null);

  async function parse() {
    setBusy(true); setError(''); setSaved(null);
    try { const d = await api('/api/commands/parse', { method: 'POST', body: { command } }); setDraft(d.draft); setSource(d.parserSource); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function updateStep(i, patch) { const steps = draft.steps.slice(); steps[i] = { ...steps[i], ...patch }; setDraft({ ...draft, steps }); }
  function removeStep(i) { setDraft({ ...draft, steps: draft.steps.filter((_, x) => x !== i) }); }

  async function approve(activate) {
    setBusy(true); setError('');
    try {
      const d = await api('/api/automations', { method: 'POST', body: { ...draft, activate } });
      setSaved(d.automation);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <h1>AI Command Center</h1>
      <p className="muted">Write what you want in plain English. The parser identifies the trigger, conditions and actions, builds a workflow, and <b>nothing is saved until you review and approve it</b>.</p>
      {error && <div className="error">{error}</div>}
      {saved && <div className="notice">Automation “{saved.name}” saved with status <b>{saved.status}</b>. <button className="btn small" onClick={() => go('automations')}>Open My Automations</button></div>}
      <div className="card">
        <label>Your command</label>
        <textarea value={command} onChange={(e) => setCommand(e.target.value)} placeholder='e.g. When a new order is received, send a WhatsApp notification to the admin.' />
        <div className="row" style={{ marginBottom: 10 }}>{EXAMPLE_COMMANDS.map((ex) => <button key={ex} className="chip" onClick={() => setCommand(ex)}>{ex.length > 58 ? ex.slice(0, 58) + '…' : ex}</button>)}</div>
        <button className="btn" onClick={parse} disabled={busy || command.trim().length < 8}>{busy ? 'Parsing…' : '✦ Generate workflow'}</button>
      </div>
      {draft && (
        <div className="card">
          <h2>Review workflow</h2>
          <p className="muted">Parsed by: <b>{source === 'builtin' ? 'built-in parser (no AI key configured)' : source}</b> · Edit anything before approving.</p>
          <label>Automation name</label><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <label>Description</label><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <label>Retry limit for failed steps</label><input type="number" min="0" max="5" value={draft.retryLimit ?? 2} onChange={(e) => setDraft({ ...draft, retryLimit: Number(e.target.value) })} />
          <div className="step"><div className="n">⚡</div><div><b>Trigger:</b> {draft.trigger.label} <span className="badge">{draft.trigger.type}</span>
            {draft.trigger.config?.time && <div className="muted">Schedule: daily at {draft.trigger.config.time} ({draft.trigger.config.timezone || 'Asia/Karachi'})</div>}
            {draft.trigger.config?.keyword && <div className="muted">Keyword match: “{draft.trigger.config.keyword}”</div>}</div></div>
          {draft.steps.map((s, i) => (
            <div className="step" key={i}><div className="n">{i + 1}</div><div style={{ flex: 1 }}>
              <input value={s.label} onChange={(e) => updateStep(i, { label: e.target.value })} style={{ marginBottom: 4 }} />
              <span className="badge">{s.type}</span> {s.config?.template && <span className="muted">Template: {s.config.template}</span>}
              {['send_email', 'send_whatsapp', 'send_telegram'].includes(s.type) && <div className="muted">Needs the matching integration connected, otherwise this step fails honestly at run time.</div>}
            </div><button className="btn ghost small" onClick={() => removeStep(i)}>Remove</button></div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => approve(true)} disabled={busy}>✓ Approve & Activate</button>
            <button className="btn ghost" onClick={() => approve(false)} disabled={busy}>Save as draft</button>
          </div>
        </div>
      )}
    </div>
  );
}
