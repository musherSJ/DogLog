const BASE = '/api';

function getToken() {
  return localStorage.getItem('doglog_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('doglog_token', token);
  else localStorage.removeItem('doglog_token');
}

export function isLoggedIn() {
  return !!getToken();
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    window.location.href = '/';
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) => request('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password, displayName) => request('/users/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  getMe: () => request('/users/me'),

  getDogs: () => request('/dogs'),
  getDog: (id) => request(`/dogs/${id}`),
  createDog: (data) => request('/dogs', { method: 'POST', body: JSON.stringify(data) }),
  updateDog: (id, data) => request(`/dogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDog: (id) => request(`/dogs/${id}`, { method: 'DELETE' }),
  getDogStats: (id) => request(`/dogs/${id}/stats`),

  getActivities: () => request('/activities'),
  getActivity: (id) => request(`/activities/${id}`),
  createActivity: (data) => request('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id, data) => request(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteActivity: (id) => request(`/activities/${id}`, { method: 'DELETE' }),
  getStats: () => request('/activities/stats'),
};
