import React from 'react';

export default function Profile({ user }) {
  if (!user) return null;
  return (
    <div><h1>Profile</h1>
      <div className="card">
        <table><tbody>
          <tr><th style={{ width: 160 }}>Name</th><td>{user.name}</td></tr>
          <tr><th>Email</th><td>{user.email}</td></tr>
          <tr><th>Role</th><td><span className="badge">{user.role}</span>{user.role === 'admin' ? ' — this account can open the Admin Panel from the sidebar.' : ''}</td></tr>
          <tr><th>User ID</th><td>{user.id}</td></tr>
          <tr><th>Account created</th><td>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</td></tr>
        </tbody></table>
        <p className="muted">Password changes use the “Forgot password?” flow on the login screen (demo mode shows the reset code, no email is sent).</p>
      </div>
    </div>
  );
}
