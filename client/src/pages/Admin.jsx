import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Admin() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  async function load() { try { setData(await api('/api/admin/overview')); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  async function setRole(id, role) { try { await api(`/api/admin/users/${id}/role`, { method: 'POST', body: { role } }); load(); } catch (e) { setError(e.message); } }
  async function delUser(id) { if (!confirm('Delete this user?')) return; try { await api(`/api/admin/users/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); } }
  async function toggleInteg(id, enabled) { try { await api(`/api/admin/integrations/${id}/enabled`, { method: 'POST', body: { enabled } }); load(); } catch (e) { setError(e.message); } }
  if (error) return <div className="error">{error} (Admin panel is only available to the admin account — the first registered user.)</div>;
  if (!data) return <p className="muted">Loading admin overview…</p>;
  return (
    <div><h1>Admin Panel</h1><p className="muted">Private to the admin account. Normal users receive 403 from these APIs.</p>
      <div className="grid">{[['Users', data.totals.users], ['Automations', data.totals.automations], ['Executions', data.totals.executions], ['Saved Records', data.totals.records]].map(([l, v]) => <div className="card" key={l} style={{ marginBottom: 0 }}><div className="stat">{v}</div><div className="statlabel">{l}</div></div>)}</div>
      <div className="card"><h2>Registered Users</h2><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>{data.users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role}</span></td>
          <td className="row"><button className="btn ghost small" onClick={() => setRole(u.id, u.role === 'admin' ? 'user' : 'admin')}>{u.role === 'admin' ? 'Make user' : 'Make admin'}</button><button className="btn danger small" onClick={() => delUser(u.id)}>Delete</button></td></tr>)}</tbody></table></div>
      <div className="card"><h2>Error Monitor</h2>{data.errors.length === 0 ? <p className="muted">No errors recorded.</p> : data.errors.map((e) => <div className="step" key={e.id}><div style={{ flex: 1 }}><b>{e.automationName}</b> — {new Date(e.startedAt).toLocaleString()}<div className="muted" style={{ color: 'var(--bad)' }}>{e.error}</div></div><span className={'badge ' + e.status}>{e.status}</span></div>)}</div>
      <div className="card"><h2>Integrations Control</h2><table><thead><tr><th>Integration</th><th>Connected</th><th>Enabled</th><th></th></tr></thead>
        <tbody>{data.integrations.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.connected ? 'Yes' : 'No'}</td><td>{i.enabled === false ? 'Disabled' : 'Enabled'}</td><td><button className="btn ghost small" onClick={() => toggleInteg(i.id, i.enabled === false)}>{i.enabled === false ? 'Enable' : 'Disable'}</button></td></tr>)}</tbody></table></div>
      <div className="card"><h2>All Automations</h2><table><thead><tr><th>Name</th><th>Status</th><th>Success</th><th>Failures</th></tr></thead>
        <tbody>{data.automations.map((a) => <tr key={a.id}><td>{a.name}</td><td><span className={'badge ' + a.status}>{a.status}</span></td><td>{a.successCount}</td><td>{a.failureCount}</td></tr>)}</tbody></table></div>
    </div>
  );
}
