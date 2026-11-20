import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function History() {
  const [list, setList] = useState([]); const [detail, setDetail] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/api/executions').then((d) => setList(d.executions)).catch((e) => setError(e.message)); }, []);
  async function open(id) { try { const d = await api(`/api/executions/${id}`); setDetail(d.execution); } catch (e) { setError(e.message); } }
  return (
    <div>
      <h1>Execution History</h1><p className="muted">Every run is logged with its trigger, duration and per-step input, output, attempts and errors. Failed steps retry automatically up to the automation's retry limit.</p>
      {error && <div className="error">{error}</div>}
      {detail && <div className="card"><div className="row"><h2 style={{ margin: 0 }}>{detail.automationName}</h2><span className={'badge ' + detail.status}>{detail.status}</span><div className="spacer" /><button className="btn ghost small" onClick={() => setDetail(null)}>Close</button></div>
        <p className="muted">{new Date(detail.startedAt).toLocaleString()} · {detail.durationMs} ms · Retries used: {detail.retryCount}</p>
        {detail.error && <div className="error">{detail.error}</div>}
        <label>Trigger payload (input)</label><pre>{JSON.stringify(detail.payload, null, 1)}</pre>
        {detail.steps.map((s, i) => <div className="step" key={i}><div className="n">{i + 1}</div><div style={{ flex: 1 }}><b>{s.label}</b> <span className="badge">{s.type}</span> — {s.status}, {s.attempts} attempt(s), {s.durationMs} ms
          {s.output && <pre>{JSON.stringify(s.output, null, 1)}</pre>}{s.error && <div className="muted" style={{ color: 'var(--bad)' }}>{s.error}</div>}</div></div>)}
      </div>}
      <div className="card">{list.length === 0 ? <p className="muted">No executions yet.</p> : (
        <table><thead><tr><th>Automation</th><th>Date & Time</th><th>Status</th><th>Trigger</th><th>Duration</th><th></th></tr></thead>
          <tbody>{list.map((e) => <tr key={e.id}><td>{e.automationName}</td><td>{new Date(e.startedAt).toLocaleString()}</td><td><span className={'badge ' + e.status}>{e.status}</span></td><td>{e.trigger?.label || e.trigger?.type}</td><td>{e.durationMs} ms</td><td><button className="btn ghost small" onClick={() => open(e.id)}>View steps</button></td></tr>)}</tbody></table>)}
      </div>
    </div>
  );
}
