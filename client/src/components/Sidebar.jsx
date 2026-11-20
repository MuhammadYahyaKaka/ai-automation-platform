import React from 'react';
import { NAV } from '../constants';

export default function Sidebar({ page, setPage, user, onLogout, theme, setTheme }) {
  return (
    <aside className="sidebar">
      <div className="logo">⚡ Auto<span>Flow</span> AI</div>
      {NAV.map((n) => (
        <button key={n.key} className={'navbtn' + (page === n.key ? ' active' : '')} onClick={() => setPage(n.key)}>
          <span>{n.icon}</span> {n.label}
        </button>
      ))}
      {user?.role === 'admin' && (
        <button className={'navbtn' + (page === 'admin' ? ' active' : '')} onClick={() => setPage('admin')}>
          <span>🛡</span> Admin Panel
        </button>
      )}
      <div className="spacer" />
      <button className="navbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        <span>{theme === 'dark' ? '☀' : '🌙'}</span> {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button className="navbtn" onClick={onLogout}><span>↩</span> Logout ({user?.name})</button>
    </aside>
  );
}
