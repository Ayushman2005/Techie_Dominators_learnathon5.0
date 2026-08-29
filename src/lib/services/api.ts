import type {
	AuthService,
	CommentService,
	CreateGrievanceInput,
	GrievanceService,
	SubmitReviewInput,
	UserService,
	UserStats,
	AuditLogService,
	HostelService,
	NoticeService,
	CreateNoticeInput
} from '$lib/services/types';
import type {
	AuthResult,
	Comment,
	CreateUserInput,
	Grievance,
	GrievanceAnalytics,
	GrievanceStatus,
	ResolutionReview,
	Result,
	Role,
	UpdateUserInput,
	User,
	AuditLog,
	AuditLogStats,
	AuditLogFilters,
	AuditLogListResponse,
	Hostel,
	Notice
} from '$lib/types';

const SESSION_KEY = 'hg.session.user';


function getCsrfToken(): string {
	if (typeof document === 'undefined') return '';
	const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch(input: RequestInfo | URL | string, init?: RequestInit): Promise<Response> {
	const options = init || {};
	const method = (options.method || 'GET').toUpperCase();
	if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		const token = getCsrfToken();
		if (token) {
			const newHeaders = new Headers(options.headers as any);
			newHeaders.set('X-CSRF-Token', token);
			options.headers = newHeaders;
		}
	}
	return fetch(input, options);
}


async function readJson(res: Response): Promise<Record<string, unknown>> {
	return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorMessage(json: Record<string, unknown>, fallback: string): string {
	return typeof json.error === 'string' ? json.error : fallback;
}

class ApiAuthService implements AuthService {
	private currentUser: User | null = null;

	async signIn(email: string, password: string): Promise<AuthResult> {
		const res = await apiFetch('/api/login', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Invalid email or password.') };
		}
		const user = json.user as User;
		this.currentUser = user;
		try {
			localStorage.setItem(SESSION_KEY, JSON.stringify(user));
		} catch {
		}
		return { ok: true, user };
	}

	async signOut(): Promise<void> {
		this.currentUser = null;
		try {
			localStorage.removeItem(SESSION_KEY);
		} catch {
		}
		await apiFetch('/api/logout', { method: 'POST', credentials: 'include' });
	}

	restore(): User | null {
		if (this.currentUser) return this.currentUser;
		try {
			const raw = localStorage.getItem(SESSION_KEY);
			if (!raw) return null;
			this.currentUser = JSON.parse(raw) as User;
			return this.currentUser;
		} catch {
			return null;
		}
	}
}

class ApiUserService implements UserService {
	async list(role?: Role): Promise<Result<User[]>> {
		const url = role ? `/api/users?role=${encodeURIComponent(role)}` : '/api/users';
		const res = await apiFetch(url, { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load users.') };
		}
		return { ok: true, data: json.data as User[] };
	}

	async listWardens(): Promise<Result<User[]>> {
		const res = await apiFetch('/api/users/wardens', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load wardens.') };
		}
		return { ok: true, data: json.data as User[] };
	}

	async getById(id: string): Promise<User | null> {
		const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await readJson(res);
		return (json.data as User) ?? null;
	}

	async create(input: CreateUserInput): Promise<Result<User>> {
		const res = await apiFetch('/api/users', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not create user.') };
		}
		return { ok: true, data: json.data as User };
	}

	async update(id: string, input: UpdateUserInput): Promise<Result<User>> {
		const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not update user.') };
		}
		return { ok: true, data: json.data as User };
	}

	async delete(id: string): Promise<Result<void>> {
		const res = await apiFetch(`/api/users/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not delete user.') };
		}
		return { ok: true, data: undefined };
	}

	async getStats(): Promise<Result<UserStats>> {
		const res = await apiFetch('/api/users/stats', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load user stats.') };
		}
		return { ok: true, data: json.data as UserStats };
	}

	async updateMyProfile(input: { phone?: string | null; emergencyContact?: string | null }): Promise<Result<User>> {
		const res = await apiFetch('/api/users/me', {
			method: 'PUT',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not update profile.') };
		}
		return { ok: true, data: json.data as User };
	}

	async changeMyPassword(current: string, next: string): Promise<Result<void>> {
		const res = await apiFetch('/api/users/me/password', {
			method: 'PUT',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ current, next })
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not change password.') };
		}
		return { ok: true, data: undefined };
	}
}

async function grievanceResult(res: Response): Promise<Result<Grievance>> {
	const json = await readJson(res);
	if (!res.ok) {
		return { ok: false, error: errorMessage(json, `Request failed (${res.status}).`) };
	}
	return { ok: true, data: json.data as Grievance };
}

class ApiGrievanceService implements GrievanceService {
	async listForStudent(_studentId: string): Promise<Result<Grievance[]>> {
		return this.list();
	}

	async listAll(): Promise<Result<Grievance[]>> {
		return this.list();
	}

	private async list(): Promise<Result<Grievance[]>> {
		const res = await apiFetch('/api/grievances', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load grievances.') };
		}
		return { ok: true, data: json.data as Grievance[] };
	}

	async getById(id: string): Promise<Result<Grievance>> {
		const res = await apiFetch(`/api/grievances/${encodeURIComponent(id)}`, { credentials: 'include' });
		return grievanceResult(res);
	}

	async create(input: CreateGrievanceInput): Promise<Result<Grievance>> {
		const file = input.attachment && 'file' in input.attachment ? (input.attachment as { file?: File }).file : undefined;
		let res: Response;
		if (file) {
			const form = new FormData();
			form.set('title', input.title);
			form.set('category', input.category);
			form.set('description', input.description);
			form.set('file', file);
			res = await apiFetch('/api/grievances', { method: 'POST', credentials: 'include', body: form });
		} else {
			res = await apiFetch('/api/grievances', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: input.title,
					category: input.category,
					description: input.description
				})
			});
		}
		return grievanceResult(res);
	}

	async updateStatus(id: string, status: GrievanceStatus): Promise<Result<Grievance>> {
		const res = await apiFetch(`/api/grievances/${encodeURIComponent(id)}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status })
		});
		return grievanceResult(res);
	}

	async delete(id: string): Promise<Result<void>> {
		const res = await apiFetch(`/api/grievances/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not delete grievance.') };
		}
		return { ok: true, data: undefined };
	}

	async submitReview(id: string, input: SubmitReviewInput): Promise<Result<Grievance>> {
		const form = new FormData();
		form.set('rating', String(input.rating));
		form.set('feedback', input.feedback);
		form.set('file', input.file);

		const res = await apiFetch(`/api/grievances/${encodeURIComponent(id)}/review`, {
			method: 'POST',
			credentials: 'include',
			body: form
		});
		return grievanceResult(res);
	}

	async getReview(id: string): Promise<Result<ResolutionReview | null>> {
		const res = await apiFetch(`/api/grievances/${encodeURIComponent(id)}/review`, {
			credentials: 'include'
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load review.') };
		}
		return { ok: true, data: (json.data as ResolutionReview) ?? null };
	}

	async getStats(): Promise<Result<any>> {
		const res = await apiFetch('/api/grievances/stats', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load grievance stats.') };
		}
		return { ok: true, data: json.data };
	}
}

class ApiCommentService implements CommentService {
	async add(grievanceId: string, _authorId: string, body: string): Promise<Result<Comment>> {
		const res = await apiFetch(`/api/grievances/${encodeURIComponent(grievanceId)}/comments`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ body })
		});
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not add the comment.') };
		}
		return { ok: true, data: json.data as Comment };
	}
}

class ApiAuditLogService implements AuditLogService {
	async list(filters: AuditLogFilters = {}): Promise<Result<AuditLogListResponse>> {
		const params = new URLSearchParams();
		if (filters.role && filters.role !== 'all') params.set('role', filters.role);
		if (filters.eventType && filters.eventType !== 'all') params.set('eventType', filters.eventType);
		if (filters.status && filters.status !== 'all') params.set('status', filters.status);
		if (filters.search) params.set('search', filters.search);
		if (filters.page) params.set('page', String(filters.page));
		if (filters.limit) params.set('limit', String(filters.limit));

		const qs = params.toString();
		const url = qs ? `/api/audit-logs?${qs}` : '/api/audit-logs';
		const res = await apiFetch(url, { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load audit logs.') };
		}
		return {
			ok: true,
			data: {
				data: (json.data as AuditLog[]) ?? [],
				total: (json.total as number) ?? 0,
				page: (json.page as number) ?? 1,
				limit: (json.limit as number) ?? 50,
				totalPages: (json.totalPages as number) ?? 1
			}
		};
	}

	async getStats(): Promise<Result<AuditLogStats>> {
		const res = await apiFetch('/api/audit-logs/stats', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) {
			return { ok: false, error: errorMessage(json, 'Could not load audit stats.') };
		}
		return { ok: true, data: json.data as AuditLogStats };
	}

	async exportLogs(format: 'json' | 'csv' = 'json', filters: AuditLogFilters = {}): Promise<Result<string | AuditLog[]>> {
		const params = new URLSearchParams();
		params.set('format', format);
		if (filters.role && filters.role !== 'all') params.set('role', filters.role);
		if (filters.eventType && filters.eventType !== 'all') params.set('eventType', filters.eventType);
		if (filters.status && filters.status !== 'all') params.set('status', filters.status);
		if (filters.search) params.set('search', filters.search);

		const url = `/api/audit-logs/export?${params.toString()}`;
		const res = await apiFetch(url, { credentials: 'include' });
		if (!res.ok) {
			const json = await readJson(res);
			return { ok: false, error: errorMessage(json, 'Could not export audit logs.') };
		}

		if (format === 'csv') {
			const text = await res.text();
			return { ok: true, data: text };
		} else {
			const json = await readJson(res);
			return { ok: true, data: (json.data as AuditLog[]) ?? [] };
		}
	}
}

export const authService: AuthService = new ApiAuthService();
export const userService: UserService = new ApiUserService();
export const grievanceService: GrievanceService = new ApiGrievanceService();
export const commentService: CommentService = new ApiCommentService();
export const auditLogService: AuditLogService = new ApiAuditLogService();

export const analyticsService = {
	async getGrievanceAnalytics(days: number = 30): Promise<Result<GrievanceAnalytics>> {
		const params = days > 0 ? `?days=${days}` : '?days=0';
		const res = await apiFetch(`/api/grievances/analytics${params}`, { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) return { ok: false, error: errorMessage(json, 'Could not load analytics.') };
		return { ok: true, data: json.data as GrievanceAnalytics };
	}
};

export const noticeService: NoticeService = {
	async list(): Promise<Result<Notice[]>> {
		const res = await apiFetch('/api/notices', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) return { ok: false, error: errorMessage(json, 'Could not fetch notices.') };
		return { ok: true, data: (json.data as Notice[]) ?? [] };
	},

	async create(input: CreateNoticeInput): Promise<Result<Notice>> {
		const res = await apiFetch('/api/notices', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
			credentials: 'include'
		});
		const json = await readJson(res);
		if (!res.ok) return { ok: false, error: errorMessage(json, 'Could not create notice.') };
		return { ok: true, data: json.data as Notice };
	},

	async delete(id: string): Promise<Result<void>> {
		const res = await apiFetch(`/api/notices/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		if (!res.ok) {
			const json = await readJson(res);
			return { ok: false, error: errorMessage(json, 'Could not delete notice.') };
		}
		return { ok: true, data: undefined };
	}
};

export const hostelService: HostelService = {
	async list(): Promise<Result<Hostel[]>> {
		const res = await apiFetch('/api/hostels', { credentials: 'include' });
		const json = await readJson(res);
		if (!res.ok) return { ok: false, error: errorMessage(json, 'Could not fetch hostels.') };
		return { ok: true, data: (json.data as Hostel[]) ?? [] };
	},

	async create(name: string): Promise<Result<Hostel>> {
		const res = await apiFetch('/api/hostels', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
			credentials: 'include'
		});
		const json = await readJson(res);
		if (!res.ok) return { ok: false, error: errorMessage(json, 'Could not create hostel.') };
		return { ok: true, data: json.data as Hostel };
	},

	async delete(id: string): Promise<Result<void>> {
		const res = await apiFetch(`/api/hostels/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		if (!res.ok) {
			const json = await readJson(res);
			return { ok: false, error: errorMessage(json, 'Could not delete hostel.') };
		}
		return { ok: true, data: undefined };
	}
};
