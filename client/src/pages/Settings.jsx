import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null); const [error, setError] = useState(''); const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/settings').then((d) => setSettings(d.settings)).catch((e) => setError(e.message)); }, []);
  async function save() {
    try { const d = await api('/api/settings', { method: 'PUT', body: settings }); setSettings(d.settings); setMsg('Settings saved.'); }
    catch (e) { setError(e.message); }
  }
  if (!settings) return <p className="muted">Loading settings…</p>;
  return (
    <div><h1>Settings</h1><p className="muted">Platform settings are stored on the server — secrets are never hardcoded in frontend code.</p>
      {error && <div className="error">{error}</div>}{msg && <div className="notice">{msg}</div>}
      <div className="card">
        <label>Platform name</label><input value={settings.platformName || ''} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
        <label>WhatsApp webhook verify token (paste the same value into Meta's webhook setup)</label><input value={settings.whatsappVerifyToken || ''} onChange={(e) => setSettings({ ...settings, whatsappVerifyToken: e.target.value })} />
        <label>Default retry limit for failed steps</label><input type="number" min="0" max="5" value={settings.defaultRetryLimit ?? 2} onChange={(e) => setSettings({ ...settings, defaultRetryLimit: Number(e.target.value) })} />
        <div className="notice">Webhook URL for Meta: <b>{window.location.origin}/webhook/whatsapp</b> — on a local machine this only works once the server is deployed to a public URL (e.g. Render).</div>
        <button className="btn" onClick={save}>Save settings</button>
      </div>
    </div>
  );
}
