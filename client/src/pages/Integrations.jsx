import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Integrations() {
  const [list, setList] = useState([]); const [open, setOpen] = useState(null);
  const [form, setForm] = useState({}); const [error, setError] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function load() { try { const d = await api('/api/integrations'); setList(d.integrations); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);

  async function connect(item) {
    setBusy(true); setError(''); setMsg('');
    try { const d = await api(`/api/integrations/${item.id}/connect`, { method: 'POST', body: { credentials: form } }); setMsg(d.detail); setOpen(null); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function disconnect(id) { try { await api(`/api/integrations/${id}/disconnect`, { method: 'POST', body: {} }); load(); } catch (e) { setError(e.message); } }

  return (
    <div>
      <h1>Integrations</h1>
      <p className="muted">An integration is shown as <b>Connected only after its credentials are saved and verified</b> (Telegram bots and Discord/Slack webhooks are verified live; WhatsApp is checked against Meta). Secrets are stored on the server and only ever shown masked.</p>
      {error && <div className="error">{error}</div>}{msg && <div className="notice">{msg}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        {list.map((item) => (
          <div className="card" key={item.id} style={{ marginBottom: 0 }}>
            <div className="row"><b>{item.name}</b><div className="spacer" /><span className={'badge ' + (item.connected ? 'success' : '')}>{item.connected ? 'Connected' : 'Not connected'}</span></div>
            <p className="muted">{item.description}</p>
            <p className="muted">{item.category}{item.enabled === false ? ' · Disabled by admin' : ''}</p>
            {item.credentialsMasked && <pre>{JSON.stringify(item.credentialsMasked, null, 1)}</pre>}
            {item.lastError && <div className="error">{item.lastError}</div>}
            {open === item.id ? (
              <div>
                {item.fields.map((f) => <div key={f.key}><label>{f.label}</label><input type={f.type === 'password' ? 'password' : 'text'} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /></div>)}
                <div className="row"><button className="btn small" onClick={() => connect(item)} disabled={busy}>{busy ? 'Verifying…' : 'Connect & Verify'}</button><button className="btn ghost small" onClick={() => setOpen(null)}>Cancel</button></div>
              </div>
            ) : (
              <div className="row">{item.connected ? <button className="btn danger small" onClick={() => disconnect(item.id)}>Disconnect</button> : <button className="btn small" onClick={() => { setOpen(item.id); setForm({}); }}>Connect</button>}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
