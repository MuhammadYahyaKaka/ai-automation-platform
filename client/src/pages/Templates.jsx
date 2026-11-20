import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Templates({ go }) {
  const [list, setList] = useState([]); const [error, setError] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/templates').then((d) => setList(d.templates)).catch((e) => setError(e.message)); }, []);
  async function use(id) {
    try { const d = await api(`/api/templates/${id}/use`, { method: 'POST', body: {} }); setMsg(`Draft created from template: “${d.automation.name}”. Review it in My Automations, customize it, then activate.`); }
    catch (e) { setError(e.message); }
  }
  return (
    <div>
      <h1>Automation Templates</h1><p className="muted">Pick a ready-made workflow, customize it, then activate it.</p>
      {error && <div className="error">{error}</div>}{msg && <div className="notice">{msg} <button className="btn small" onClick={() => go('automations')}>Open My Automations</button></div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {list.map((t) => <div className="card" key={t.id} style={{ marginBottom: 0 }}><b>{t.name}</b><p className="muted">{t.description}</p>
          <p className="muted">Trigger: {t.trigger.label}<br />Steps: {t.steps.map((s) => s.label).join(' → ')}</p>
          <button className="btn small" onClick={() => use(t.id)}>Use this template</button></div>)}
      </div>
    </div>
  );
}
