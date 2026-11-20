// Small API wrapper: attaches the login token and surfaces server errors.
const BASE = import.meta.env.VITE_API_URL || '';

export function getToken() { return localStorage.getItem('auto_token'); }
export function setToken(t) { t ? localStorage.setItem('auto_token', t) : localStorage.removeItem('auto_token'); }

export async function api(path, options = {}) {
  const resp = await fetch(BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) { const err = new Error(data.error || `Request failed (${resp.status})`); err.status = resp.status; throw err; }
  return data;
}
