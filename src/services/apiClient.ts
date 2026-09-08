import type {
  User,
  Role,
  Grievance,
  GrievanceStatus,
  Notice,
  AuditLog,
  AuditLogStats,
  Hostel,
  GrievanceAnalytics,
  ResolutionReview,
  Comment
} from '../types';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  // If body is NOT FormData and not explicitly set, set Content-Type to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `Request failed with status ${res.status}`;
      return { ok: false, status: res.status, error: errorMsg, data };
    }

    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || 'Network error occurred' };
  }
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ ok: boolean; user?: User; error?: string }> {
    const res = await apiFetch<{ user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.ok && res.data?.user) {
      return { ok: true, user: res.data.user };
    }
    return { ok: false, error: res.error || 'Failed to login' };
  },

  async logout(): Promise<void> {
    await apiFetch('/api/logout', { method: 'POST' });
  },

  async getMe(): Promise<{ ok: boolean; user?: User }> {
    const res = await apiFetch<{ user: User }>('/api/me');
    if (res.ok && res.data?.user) {
      return { ok: true, user: res.data.user };
    }
    return { ok: false };
  },

  async register(data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    rollNo?: string;
    room?: string;
    empId?: string;
    hostelId?: string;
  }): Promise<{ ok: boolean; user?: User; error?: string }> {
    const res = await apiFetch<{ user: User }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.ok && res.data?.user) {
      return { ok: true, user: res.data.user };
    }
    return { ok: false, error: res.error || 'Registration failed' };
  },

  async registerStudent(data: {
    name: string;
    email: string;
    password: string;
    rollNo: string;
    room: string;
    hostelId?: string;
  }): Promise<{ ok: boolean; user?: User; error?: string }> {
    return this.register({ ...data, role: 'student' });
  },

  // Grievances
  async getGrievances(params: {
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: Grievance[]; total: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status.toLowerCase().replace(' ', '_'));
    if (params.category && params.category !== 'all') query.set('category', params.category);
    if (params.priority && params.priority !== 'all') query.set('priority', params.priority.toLowerCase());
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const res = await apiFetch<{ data: Grievance[]; total: number; totalPages: number }>(
      `/api/grievances?${query.toString()}`
    );
    if (res.ok && res.data) {
      return res.data;
    }
    return { data: [], total: 0, totalPages: 1 };
  },

  async getGrievance(id: string): Promise<{ ok: boolean; grievance?: Grievance; error?: string }> {
    const res = await apiFetch<{ grievance: Grievance }>(`/api/grievances/${id}`);
    if (res.ok && res.data?.grievance) {
      return { ok: true, grievance: res.data.grievance };
    }
    return { ok: false, error: res.error };
  },

  async createGrievance(formData: {
    title: string;
    category: string;
    description: string;
    priority: string;
    availableTime?: string;
    file?: File;
  }): Promise<{ ok: boolean; grievance?: Grievance; error?: string }> {
    if (formData.file) {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('category', formData.category);
      data.append('description', formData.description);
      data.append('priority', formData.priority);
      if (formData.availableTime) data.append('availableTime', formData.availableTime);
      data.append('file', formData.file);

      const res = await apiFetch<{ grievance: Grievance }>('/api/grievances', {
        method: 'POST',
        body: data
      });
      return res.ok && res.data?.grievance
        ? { ok: true, grievance: res.data.grievance }
        : { ok: false, error: res.error };
    } else {
      const res = await apiFetch<{ grievance: Grievance }>('/api/grievances', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      return res.ok && res.data?.grievance
        ? { ok: true, grievance: res.data.grievance }
        : { ok: false, error: res.error };
    }
  },

  async updateStatus(id: string, status: GrievanceStatus, note?: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/grievances/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note })
    });
    return { ok: res.ok, error: res.error };
  },

  async updatePriority(id: string, priority: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/grievances/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority })
    });
    return { ok: res.ok, error: res.error };
  },

  async addComment(id: string, body: string): Promise<{ ok: boolean; comment?: Comment; error?: string }> {
    const res = await apiFetch<{ comment: Comment }>(`/api/grievances/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
    return res.ok ? { ok: true, comment: res.data?.comment } : { ok: false, error: res.error };
  },

  async submitReview(
    grievanceId: string,
    review: { rating: number; feedback: string; file?: File }
  ): Promise<{ ok: boolean; error?: string }> {
    if (review.file) {
      const data = new FormData();
      data.append('rating', String(review.rating));
      data.append('feedback', review.feedback);
      data.append('file', review.file);
      const res = await apiFetch(`/api/grievances/${grievanceId}/review`, {
        method: 'POST',
        body: data
      });
      return { ok: res.ok, error: res.error };
    } else {
      const res = await apiFetch(`/api/grievances/${grievanceId}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating: review.rating, feedback: review.feedback })
      });
      return { ok: res.ok, error: res.error };
    }
  },

  async getAnalytics(): Promise<GrievanceAnalytics | null> {
    const res = await apiFetch<any>('/api/grievances/analytics');
    if (res.ok && res.data) {
      return res.data.data || res.data.analytics || null;
    }
    return null;
  },

  // Notices
  async getNotices(): Promise<Notice[]> {
    const res = await apiFetch<{ notices: Notice[] }>('/api/notices');
    return res.ok && res.data?.notices ? res.data.notices : [];
  },

  async createNotice(data: { title: string; body: string; hostel_id?: string | null }): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/notices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return { ok: res.ok, error: res.error };
  },

  async deleteNotice(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/notices/${id}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, error: res.error };
  },

  // Users
  async getUsers(params: { role?: string; search?: string } = {}): Promise<User[]> {
    const q = new URLSearchParams();
    if (params.role) q.set('role', params.role);
    if (params.search) q.set('search', params.search);
    const res = await apiFetch<{ users: User[] }>(`/api/users?${q.toString()}`);
    return res.ok && res.data?.users ? res.data.users : [];
  },

  async getWardens(): Promise<User[]> {
    const res = await apiFetch<{ wardens: User[] }>('/api/users/wardens');
    return res.ok && res.data?.wardens ? res.data.wardens : [];
  },

  async createUser(data: Partial<User> & { password: string }): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return { ok: res.ok, error: res.error };
  },

  async deleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch(`/api/users/${id}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, error: res.error };
  },

  // Hostels
  async getHostels(): Promise<Hostel[]> {
    const res = await apiFetch<{ hostels: Hostel[] }>('/api/hostels');
    return res.ok && res.data?.hostels ? res.data.hostels : [];
  },

  async createHostel(name: string): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/hostels', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    return { ok: res.ok, error: res.error };
  },

  // Audit Logs
  async getAuditLogs(params: {
    role?: string;
    eventType?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ logs: AuditLog[]; total: number; totalPages: number }> {
    const q = new URLSearchParams();
    if (params.role) q.set('role', params.role);
    if (params.eventType) q.set('eventType', params.eventType);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));

    const res = await apiFetch<{ data: AuditLog[]; total: number; totalPages: number }>(
      `/api/audit-logs?${q.toString()}`
    );
    if (res.ok && res.data) {
      return { logs: res.data.data, total: res.data.total, totalPages: res.data.totalPages };
    }
    return { logs: [], total: 0, totalPages: 1 };
  },

  async getAuditStats(): Promise<AuditLogStats | null> {
    const res = await apiFetch<{ stats: AuditLogStats }>('/api/audit-logs/stats');
    return res.ok && res.data?.stats ? res.data.stats : null;
  }
};
