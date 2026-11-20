import React, { useState } from 'react';
import { api, setToken } from '../api';

export default function Register({ onAuth, goLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const d = await api('/api/auth/register', { method: 'POST', body: form }); setToken(d.token); if (d.note) setNote(d.note); onAuth(d.user); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="authwrap"><div className="card authcard">
      <div className="logo" style={{ paddingLeft: 0 }}>⚡ Auto<span>Flow</span> AI</div>
      <h1>Create account</h1><p className="muted">The first account registered becomes the platform admin.</p>
      {error && <div className="error">{error}</div>}{note && <div className="notice">{note}</div>}
      <form onSubmit={submit}>
        <label>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <label>Password (min 8 characters)</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      </form>
      <div className="row" style={{ marginTop: 12 }}><span className="muted">Already have an account?</span><button className="btn ghost small" onClick={goLogin}>Log in</button></div>
    </div></div>
  );
}
