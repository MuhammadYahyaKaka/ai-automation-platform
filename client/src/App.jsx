import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Sidebar from './components/Sidebar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import MyAutomations from './pages/MyAutomations.jsx';
import Builder from './pages/Builder.jsx';
import Integrations from './pages/Integrations.jsx';
import History from './pages/History.jsx';
import Templates from './pages/Templates.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';

// App.jsx holds only routing + shared state. Every page lives in its own
// file under src/pages/.
export default function App() {
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('auto_theme') || 'light');
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('auto_theme', theme); }, [theme]);
  useEffect(() => {
    if (getToken()) api('/api/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  function onAuth(u) { setUser(u); setPage('dashboard'); }
  function logout() { setToken(null); setUser(null); }

  if (loading) return <div className="authwrap"><p className="muted">Loading…</p></div>;
  if (!user) return authView === 'login'
    ? <Login onAuth={onAuth} goRegister={() => setAuthView('register')} />
    : <Register onAuth={onAuth} goLogin={() => setAuthView('login')} />;

  const pages = {
    dashboard: <Dashboard go={setPage} />, command: <CommandCenter go={setPage} />,
    automations: <MyAutomations go={setPage} />, builder: <Builder go={setPage} />,
    integrations: <Integrations />, history: <History />, templates: <Templates go={setPage} />,
    settings: <Settings />, profile: <Profile user={user} />, admin: <Admin />,
  };
  return (
    <div className="layout">
      <Sidebar page={page} setPage={setPage} user={user} onLogout={logout} theme={theme} setTheme={setTheme} />
      <main className="main">{pages[page] || pages.dashboard}</main>
    </div>
  );
}
