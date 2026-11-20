import React, { useState } from 'react';
import { api, setToken } from '../api';

export default function Login({ onAuth, goRegister }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [reset, setReset] = useState(null); const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const d = await api('/api/auth/login', { method: 'POST', body: { email, password } }); setToken(d.token); onAuth(d.user); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function forgot() {
    setError('');
    try { const d = await api('/api/auth/forgot-password', { method: 'POST', body: { email } }); setReset(d); }
    catch (err) { setError(err.message); }
  }
  async function doReset(e) {
    e.preventDefault();
    try { await api('/api/auth/reset-password', { method: 'POST', body: { email, code: reset.code, newPassword: reset.newPassword } }); setReset({ done: true }); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="authwrap"><div className="card authcard">
      <div className="logo" style={{ paddingLeft: 0 }}>⚡ Auto<span>Flow</span> AI</div>
      <h1>Log in</h1><p className="muted">Welcome back to your automation platform.</p>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost small" onClick={forgot}>Forgot password?</button>
        <div className="spacer" />
        <button className="btn ghost small" onClick={goRegister}>Create account</button>
      </div>
      {reset && !reset.done && (
        <form onSubmit={doReset} style={{ marginTop: 14 }}>
          <div className="notice">{reset.message} Code: <b>{reset.resetCode}</b></div>
          <label>Reset code</label><input value={reset.code || ''} onChange={(e) => setReset({ ...reset, code: e.target.value })} required />
          <label>New password (min 8)</label><input type="password" value={reset.newPassword || ''} onChange={(e) => setReset({ ...reset, newPassword: e.target.value })} required />
          <button className="btn" style={{ width: '100%' }}>Reset password</button>
        </form>
      )}
      {reset?.done && <div className="notice" style={{ marginTop: 14 }}>Password reset. Log in with your new password.</div>}
    </div></div>
  );
}
