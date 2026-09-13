// The API origin. Override at build/run time with VITE_API_URL (see README),
// otherwise it falls back to the local dev server.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Turns a server-relative path (e.g. "/uploads/abc.png") into a full URL that
// works when the API lives on a different origin than the frontend.
export const mediaUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return `${API_BASE_URL.replace(/\/api\/?$/, '')}${path}`;
  return path;
};

const getHeaders = () => {
  const token = localStorage.getItem('ecoguard_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const getJson = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const api = {
  auth: {
    login: async (email, password) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return getJson(res);
    },
    register: async (name, email, password) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      return getJson(res);
    },
    getProfile: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, { headers: getHeaders() });
      return getJson(res);
    },
    updateProfile: async (name) => {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name }),
      });
      return getJson(res);
    },
    changePassword: async (currentPassword, newPassword) => {
      const res = await fetch(`${API_BASE_URL}/auth/password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      return getJson(res);
    },
    updateTheme: async (theme) => {
      const res = await fetch(`${API_BASE_URL}/auth/theme`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ theme }),
      });
      return getJson(res);
    },
    forgotPassword: async (email) => {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return getJson(res);
    },
    resetPassword: async (token, newPassword) => {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      return getJson(res);
    },
    deleteAccount: async (currentPassword) => {
      const res = await fetch(`${API_BASE_URL}/auth/account`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ current_password: currentPassword }),
      });
      return getJson(res);
    },
  },

  hazards: {
    getAll: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.search) params.append('search', filters.search);
      const res = await fetch(`${API_BASE_URL}/hazards?${params}`);
      return getJson(res);
    },
    getById: async (id) => {
      const res = await fetch(`${API_BASE_URL}/hazards/${id}`);
      return getJson(res);
    },
    getCategories: async () => {
      const res = await fetch(`${API_BASE_URL}/hazards/meta/categories`);
      return getJson(res);
    },
  },

  reports: {
    getAll: async (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.severity) params.append('severity', filters.severity);
      const res = await fetch(`${API_BASE_URL}/reports?${params}`);
      return getJson(res);
    },
    getMyReports: async () => {
      const res = await fetch(`${API_BASE_URL}/reports/my-reports`, { headers: getHeaders() });
      return getJson(res);
    },
    submit: async (formData) => {
      // multipart/form-data — do not set Content-Type; the browser adds the boundary.
      const token = localStorage.getItem('ecoguard_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/reports/submit`, {
        method: 'POST',
        headers,
        body: formData,
      });
      return getJson(res);
    },
    track: async (id) => {
      const res = await fetch(`${API_BASE_URL}/reports/track/${encodeURIComponent(id)}`);
      return getJson(res);
    },
  },

  notifications: {
    getAll: async () => {
      const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getHeaders() });
      return getJson(res);
    },
    markRead: async (id) => {
      const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return getJson(res);
    },
    markAllRead: async () => {
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return getJson(res);
    },
  },

  admin: {
    getUsers: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: getHeaders() });
      return getJson(res);
    },
    updateReportStatus: async (id, status, notes) => {
      const res = await fetch(`${API_BASE_URL}/admin/reports/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status, admin_notes: notes }),
      });
      return getJson(res);
    },
    deleteReport: async (id) => {
      const res = await fetch(`${API_BASE_URL}/admin/reports/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return getJson(res);
    },
    updateUserRole: async (id, role) => {
      const res = await fetch(`${API_BASE_URL}/admin/users/${id}/role`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
      });
      return getJson(res);
    },
    updateUserStatus: async (id, status) => {
      const res = await fetch(`${API_BASE_URL}/admin/users/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });
      return getJson(res);
    },
    // Admin & Security endpoints
    getAdministrators: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/administrators`, { headers: getHeaders() });
      return getJson(res);
    },
    getAdministratorDetails: async (id) => {
      const res = await fetch(`${API_BASE_URL}/admin/administrators/${id}`, { headers: getHeaders() });
      return getJson(res);
    },
    getAuditLog: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);
      const url = queryParams.toString() ? `${API_BASE_URL}/admin/audit-log?${queryParams}` : `${API_BASE_URL}/admin/audit-log`;
      const res = await fetch(url, { headers: getHeaders() });
      return getJson(res);
    },
    getSecurityOverview: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/security-overview`, { headers: getHeaders() });
      return getJson(res);
    },
  },
};
