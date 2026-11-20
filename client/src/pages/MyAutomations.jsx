import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function MyAutomations({ go }) {
  const [list, setList] = useState([]); const [error, setError] = useState(''); const [result, setResult] = useState(null);
  async function load() { try { const d = await api('/api/automations'); setList(d.automations); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  async function act(id, action) { try { await api(`/api/automations/${id}/status`, { method: 'POST', body: { action } }); load(); } catch (e) { setError(e.message); } }
  async function run(id) { try { const d = await api(`/api/automations/${id}/run`, { method: 'POST', body: {} }); setResult(d.execution); load(); } catch (e) { setError(e.message); } }
  async function dup(id) { try { await api(`/api/automations/${id}/duplicate`, { method: 'POST', body: {} }); load(); } catch (e) { setError(e.message); } }
  async function del(id) { if (!confirm('Delete this automation permanently? Its execution history is kept.')) return; try { await api(`/api/automations/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); } }

  return (
    <div>
      <div className="topbar"><div><h1>My Automations</h1><p className="muted">Run, pause, duplicate and delete your workflows.</p></div>
        <div className="row"><button className="btn ghost" onClick={() => go('builder')}>Open Visual Builder</button><button className="btn" onClick={() => go('command')}>✦ New from command</button></div></div>
      {error && <div className="error">{error}</div>}
      {result && <div className="card"><h2>Run finished: <span className={'badge ' + result.status}>{result.status}</span></h2>
        {result.error && <div className="error">{result.error}</div>}
        {result.steps.map((s, i) => <div className="step" key={i}><div className="n">{i + 1}</div><div><b>{s.label}</b> — {s.status} ({s.attempts} attempt(s), {s.durationMs} ms){s.error && <div className="muted" style={{ color: 'var(--bad)' }}>{s.error}</div>}</div></div>)}
        <button className="btn ghost small" onClick={() => go('history')}>See full history</button></div>}
      {list.length === 0 ? <div className="card"><p className="muted">No automations yet. Create one from a command, the builder, or a template.</p></div> :
        list.map((a) => (
          <div className="card" key={a.id}>
            <div className="row"><b style={{ fontSize: 16 }}>{a.name}</b><span className={'badge ' + a.status}>{a.status}</span><div className="spacer" />
              <button className="btn small" onClick={() => run(a.id)}>▶ Run now</button>
              {a.status === 'active' ? <button className="btn ghost small" onClick={() => act(a.id, 'pause')}>Pause</button> : <button className="btn ghost small" onClick={() => act(a.id, 'activate')}>Activate</button>}
              <button className="btn ghost small" onClick={() => dup(a.id)}>Duplicate</button>
              <button className="btn danger small" onClick={() => del(a.id)}>Delete</button></div>
            <p className="muted">{a.description}</p>
            <p className="muted">Trigger: <b>{a.trigger?.label}</b> · Steps: {(a.steps || []).map((s) => s.label).join(' → ')}<br />
              Last run: {a.lastRun ? new Date(a.lastRun).toLocaleString() : 'Never'} · Next run: {a.nextRun ? new Date(a.nextRun).toLocaleString() : '—'} · Success: {a.successCount} · Failures: {a.failureCount} · Retry limit: {a.retryLimit}</p>
          </div>
        ))}
    </div>
  );
}
