import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Dashboard({ go }) {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { api('/api/dashboard').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Loading dashboard…</p>;
  const max = Math.max(1, ...data.performance.map((d) => d.total));
  const stats = [
    ['Total Automations', data.totalAutomations], ['Active Automations', data.activeAutomations],
    ['Paused Automations', data.pausedAutomations], ['Successful Executions', data.successfulExecutions],
    ['Failed Executions', data.failedExecutions],
  ];
  return (
    <div>
      <div className="topbar"><div><h1>Dashboard</h1><p className="muted">Your automations at a glance — all numbers come from real execution records.</p></div>
        <button className="btn" onClick={() => go('command')}>✦ New automation from a command</button></div>
      <div className="grid">{stats.map(([l, v]) => <div className="card" key={l} style={{ marginBottom: 0 }}><div className="stat">{v}</div><div className="statlabel">{l}</div></div>)}</div>
      <div className="card"><h2>Automation Performance — last 14 days</h2>
        <div className="bar-wrap">{data.performance.map((d) => (
          <div className="bar-col" key={d.date} title={`${d.date}: ${d.success} ok, ${d.failed} failed`}>
            <div className="row" style={{ gap: 2, alignItems: 'flex-end' }}>
              <div className="bar" style={{ height: Math.max(2, (d.success / max) * 84) }} />
              <div className="bar fail" style={{ height: Math.max(2, (d.failed / max) * 84) }} />
            </div><span className="muted" style={{ fontSize: 10 }}>{d.date.slice(5)}</span>
          </div>))}</div>
        <p className="muted">Violet = successful runs · Red = failed / partial runs</p></div>
      <div className="card"><h2>Recent Activity</h2>
        {data.recentActivity.length === 0 ? <p className="muted">No executions yet. Create an automation and run it — its activity will appear here.</p> : (
          <table><thead><tr><th>Automation</th><th>When</th><th>Status</th><th>Duration</th></tr></thead>
            <tbody>{data.recentActivity.map((e) => <tr key={e.id}><td>{e.automationName}</td><td>{new Date(e.startedAt).toLocaleString()}</td><td><span className={'badge ' + e.status}>{e.status}</span></td><td>{e.durationMs} ms</td></tr>)}</tbody></table>)}
      </div>
    </div>
  );
}
