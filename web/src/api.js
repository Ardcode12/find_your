const BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000');

function getToken() {
  return localStorage.getItem('kec_lf_token');
}

async function request(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────
export const api = {
  login: (email, password) =>
    request('POST', '/auth/login', { email, password }, false),

  signup: (data) =>
    request('POST', '/auth/signup', data, false),

  me: () => request('GET', '/auth/me'),

  // ── Items ────────────────────────────────────────────
  getItems: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && q.set(k, v));
    return request('GET', `/items?${q}`);
  },

  getItem: (id) => request('GET', `/items/${id}`),

  createItem: (data) => request('POST', '/items', data),

  escalateToDept: (id, data) =>
    request('POST', `/items/${id}/escalate-to-department`, data),

  escalateToAdmin: (id, data) =>
    request('POST', `/department/items/${id}/escalate-to-admin`, data),

  studentDeliverToOwner: (id, data) =>
    request('POST', `/items/${id}/deliver-to-owner`, data),

  getMyActivity: () => request('GET', '/items/my-activity'),

  // ── Claims ──────────────────────────────────────────
  submitClaim: (itemId, hidden_details) =>
    request('POST', `/items/${itemId}/claim`, { hidden_details }),

  verifyClaim: (claimId, approved, notes = '', handoverData = {}) =>
    request('POST', `/claims/${claimId}/verify`, { approved, notes, ...handoverData }),

  getItemClaims: (itemId) =>
    request('GET', `/items/${itemId}/claims`),

  getClaims: (status) => {
    const q = status ? `?status=${status}` : '';
    return request('GET', `/claims${q}`);
  },

  // ── Messages ─────────────────────────────────────────
  getMessages: (itemId) => request('GET', `/items/${itemId}/messages`),

  sendMessage: (itemId, message) =>
    request('POST', `/items/${itemId}/messages`, { message }),

  // ── Notifications ────────────────────────────────────
  getNotifications: () => request('GET', '/notifications'),

  // ── Department Portal ────────────────────────────────
  getDeptItems: (params = {}) => {
    const q = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) q.set('status', params);
    } else {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, v);
      });
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request('GET', `/department/items${qs}`);
  },

  getDeptStats: () => request('GET', '/department/stats'),

  deptReceiveItem: (id) =>
    request('POST', `/department/items/${id}/receive`),

  deptVerifyItem: (id, data) =>
    request('POST', `/department/items/${id}/verify`, data),

  // ── Admin Portal ─────────────────────────────────────
  getAdminItems: (params = {}) => {
    const q = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) q.set('status', params);
    } else {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.set(k, v);
      });
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request('GET', `/admin/items${qs}`);
  },

  getAdminAnalytics: () => request('GET', '/admin/analytics'),

  adminCloseItem: (id, data) =>
    request('POST', `/admin/items/${id}/close`, data),

  deleteAdminItem: (id) =>
    request('DELETE', `/admin/items/${id}`),

  autoEscalate: () => request('POST', '/system/auto-escalate'),

  // ── Departments ──────────────────────────────────────
  getDepartments: () => request('GET', '/departments', null, false),

  createDepartment: (data) => request('POST', '/departments', data),

  updateDepartment: (id, data) => request('PUT', `/departments/${id}`, data),

  deleteDepartment: (id) => request('DELETE', `/departments/${id}`),

  // ── Misc ─────────────────────────────────────────────
  getCategories: () => request('GET', '/categories'),

  analyzeImage: (image_url) =>
    request('POST', '/gemini/analyze-image', { image_url }),
};

export default api;
