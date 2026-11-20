import React, { useState } from 'react';
import { api } from '../api';
import { TRIGGER_TYPES, STEP_TYPES } from '../constants';

export default function Builder({ go }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('new_order');
  const [keyword, setKeyword] = useState(''); const [time, setTime] = useState('09:00');
  const [steps, setSteps] = useState([{ type: 'save_record', label: 'Save order in database', config: {} }]);
  const [error, setError] = useState(''); const [saved, setSaved] = useState(null);

  function move(i, dir) { const s = steps.slice(); const j = i + dir; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setSteps(s); }
  function addStep(type) { const meta = STEP_TYPES.find((t) => t.type === type); const cfg = type === 'condition' ? { field: 'paymentStatus', equals: 'paid' } : type === 'delay' ? { seconds: 1 } : (type.startsWith('send_') ? { template: 'Notification: {{summary}}' } : {}); setSteps([...steps, { type, label: meta.label, config: cfg }]); }
  async function save(activate) {
    setError('');
    const meta = TRIGGER_TYPES.find((t) => t.type === triggerType);
    const trigger = { type: triggerType, label: meta.label, config: triggerType === 'schedule' ? { schedule: 'daily', time, timezone: 'Asia/Karachi' } : triggerType === 'whatsapp_message' && keyword ? { keyword } : {} };
    try { const d = await api('/api/automations', { method: 'POST', body: { name: name || 'Untitled automation', description, trigger, steps, retryLimit: 2, activate } }); setSaved(d.automation); }
    catch (e) { setError(e.message); }
  }
  return (
    <div>
      <h1>Visual Builder</h1><p className="muted">Build a workflow step by step — add triggers, conditions, actions, delays and filters, reorder them, then save. Drag-and-drop is replaced by simple up/down controls that work on mobile too.</p>
      {error && <div className="error">{error}</div>}
      {saved && <div className="notice">Saved “{saved.name}” as <b>{saved.status}</b>. <button className="btn small" onClick={() => go('automations')}>Open My Automations</button></div>}
      <div className="card">
        <label>Automation name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Order → WhatsApp alert" />
        <label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} />
        <label>Trigger</label><select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>{TRIGGER_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label} ({t.type})</option>)}</select>
        {triggerType === 'schedule' && <><label>Time (Asia/Karachi)</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></>}
        {triggerType === 'whatsapp_message' && <><label>Only reply when the message contains this keyword (optional)</label><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g. price" /></>}
      </div>
      <div className="card"><h2>Steps</h2>
        {steps.map((s, i) => (
          <div className="step" key={i}><div className="n">{i + 1}</div><div style={{ flex: 1 }}>
            <input value={s.label} onChange={(e) => { const c = steps.slice(); c[i] = { ...s, label: e.target.value }; setSteps(c); }} style={{ marginBottom: 4 }} />
            <span className="badge">{s.type}</span> {s.config?.template !== undefined && <input value={s.config.template} placeholder="Message template, use {{name}}, {{orderId}}, {{message}}" onChange={(e) => { const c = steps.slice(); c[i] = { ...s, config: { ...s.config, template: e.target.value } }; setSteps(c); }} style={{ marginTop: 6 }} />}
          </div>
            <div className="row"><button className="btn ghost small" onClick={() => move(i, -1)}>↑</button><button className="btn ghost small" onClick={() => move(i, 1)}>↓</button><button className="btn ghost small" onClick={() => setSteps(steps.filter((_, x) => x !== i))}>✕</button></div></div>
        ))}
        <label style={{ marginTop: 10 }}>Add a step</label>
        <div className="row">{STEP_TYPES.map((t) => <button key={t.type} className="chip" onClick={() => addStep(t.type)}>+ {t.label}</button>)}</div>
        <div className="row" style={{ marginTop: 14 }}><button className="btn" onClick={() => save(true)}>Save & Activate</button><button className="btn ghost" onClick={() => save(false)}>Save as draft</button></div>
      </div>
    </div>
  );
}
