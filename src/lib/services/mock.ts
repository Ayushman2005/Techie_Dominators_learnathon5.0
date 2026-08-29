import {
	MOCK_CREDENTIALS,
	MOCK_NOW,
	MOCK_USERS,
	buildSeedGrievances
} from '$lib/mocks/mock-data';
import type {
	AuthService,
	CommentService,
	GrievanceService,
	SubmitReviewInput,
	UserService,
	CreateGrievanceInput,
	UserStats
} from '$lib/services/types';
import type {
	Attachment,
	AuthResult,
	Comment,
	CreateUserInput,
	Grievance,
	GrievanceStatus,
	ResolutionReview,
	Result,
	Role,
	UpdateUserInput,
	User
} from '$lib/types';

const LATENCY_MS = 350;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const SESSION_KEY = 'hg.session.userId';

const grievances: Grievance[] = buildSeedGrievances();

function nextGrievanceId(): string {
	const nums = grievances
		.map((g) => Number.parseInt(g.id.replace('GRV-', ''), 10))
		.filter((n) => !Number.isNaN(n));
	const max = nums.length ? Math.max(...nums) : 0;
	return `GRV-${String(max + 1).padStart(4, '0')}`;
}

function nowIso(): string {
	return MOCK_NOW;
}

function touch(g: Grievance): void {
	g.updatedAt = nowIso();
}

class MockAuthService implements AuthService {
	private currentUser: User | null = null;

	async signIn(email: string, password: string): Promise<AuthResult> {
		const match = MOCK_CREDENTIALS.find(
			(c) => c.email === email.trim().toLowerCase() && c.password === password
		);
		if (!match) {
			return delay({ ok: false as const, error: 'Invalid email or password.' });
		}
		const user = findUser(match.userId);
		if (!user) {
			return delay({ ok: false as const, error: 'Account not provisioned.' });
		}
		this.currentUser = user;
		try {
			localStorage.setItem(SESSION_KEY, user.id);
		} catch {
		}
		return delay({ ok: true as const, user });
	}

	async signOut(): Promise<void> {
		this.currentUser = null;
		try {
			localStorage.removeItem(SESSION_KEY);
		} catch {
		}
	}

	restore(): User | null {
		if (this.currentUser) return this.currentUser;
		try {
			const id = localStorage.getItem(SESSION_KEY);
			if (!id) return null;
			this.currentUser = findUser(id);
			return this.currentUser;
		} catch {
			return null;
		}
	}
}

function findUser(id: string): User | null {
	return MOCK_USERS[id] ?? null;
}

function enrichUser(u: User): User {
	const clone = { ...u };
	if (clone.wardenId && MOCK_USERS[clone.wardenId]) {
		clone.warden = { ...MOCK_USERS[clone.wardenId] };
	}
	return clone;
}

class MockUserService implements UserService {
	async list(role?: Role): Promise<Result<User[]>> {
		let list = Object.values(MOCK_USERS);
		if (role) list = list.filter((u) => u.role === role);
		return delay({ ok: true as const, data: list.map(enrichUser) });
	}

	async listWardens(): Promise<Result<User[]>> {
		const list = Object.values(MOCK_USERS).filter((u) => u.role === 'warden');
		return delay({ ok: true as const, data: list.map(enrichUser) });
	}

	async getById(id: string): Promise<User | null> {
		const u = MOCK_USERS[id];
		return delay(u ? enrichUser(u) : null, 80);
	}

	async create(input: CreateUserInput): Promise<Result<User>> {
		const newId = `usr-${Date.now()}`;
		const user: User = {
			id: newId,
			name: input.name,
			email: input.email,
			role: input.role,
			room: input.room,
			rollNo: input.rollNo ?? input.studentId,
			studentId: input.studentId ?? input.rollNo,
			empId: input.empId,
			wardenId: input.wardenId,
			createdAt: nowIso()
		};
		MOCK_USERS[newId] = user;
		return delay({ ok: true as const, data: enrichUser(user) });
	}

	async update(id: string, input: UpdateUserInput): Promise<Result<User>> {
		const user = MOCK_USERS[id];
		if (!user) return delay({ ok: false as const, error: 'User not found.' });
		if (input.name) user.name = input.name;
		if (input.email) user.email = input.email;
		if (input.role) user.role = input.role;
		if (input.room !== undefined) user.room = input.room;
		if (input.rollNo !== undefined || input.studentId !== undefined) {
			user.rollNo = input.rollNo ?? input.studentId ?? null;
			user.studentId = input.studentId ?? input.rollNo ?? null;
		}
		if (input.empId !== undefined) user.empId = input.empId;
		if (input.wardenId !== undefined) user.wardenId = input.wardenId;
		return delay({ ok: true as const, data: enrichUser(user) });
	}

	async delete(id: string): Promise<Result<void>> {
		delete MOCK_USERS[id];
		return delay({ ok: true as const, data: undefined });
	}

	async getStats(): Promise<Result<UserStats>> {
		const list = Object.values(MOCK_USERS);
		const stats: UserStats = {
			student: list.filter((u) => u.role === 'student').length,
			warden: list.filter((u) => u.role === 'warden').length,
			admin: list.filter((u) => u.role === 'admin').length,
			total: list.length
		};
		return delay({ ok: true as const, data: stats });
	}

	async updateMyProfile(input: { phone?: string | null; emergencyContact?: string | null }): Promise<Result<User>> {
		const user = MOCK_USERS['usr-student-1']; // mock implementation
		if (input.phone !== undefined) user.phone = input.phone;
		if (input.emergencyContact !== undefined) user.emergencyContact = input.emergencyContact;
		return delay({ ok: true as const, data: enrichUser(user) });
	}

	async changeMyPassword(current: string, next: string): Promise<Result<void>> {
		return delay({ ok: true as const, data: undefined });
	}
}

class MockGrievanceService implements GrievanceService {
	async listForStudent(studentId: string): Promise<Result<Grievance[]>> {
		const data = grievances
			.filter((g) => g.studentId === studentId)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map(clone);
		return delay({ ok: true as const, data });
	}

	async listAll(): Promise<Result<Grievance[]>> {
		const data = [...grievances]
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			.map(clone);
		return delay({ ok: true as const, data });
	}

	async getById(id: string): Promise<Result<Grievance>> {
		const g = grievances.find((x) => x.id === id);
		if (!g) {
			return delay({ ok: false as const, error: `Grievance ${id} was not found.` });
		}
		return delay({ ok: true as const, data: clone(g) });
	}

	async create(input: CreateGrievanceInput): Promise<Result<Grievance>> {
		const student = findUser(input.studentId);
		if (!student) {
			return delay({ ok: false as const, error: 'Unknown student.' });
		}
		const id = nextGrievanceId();
		const attachments: Attachment[] = [];
		if (input.attachment) {
			attachments.push({
				id: `att-${id}`,
				filename: input.attachment.filename,
				sizeBytes: input.attachment.sizeBytes,
				contentType: input.attachment.contentType
			});
		}
		const grievance: Grievance = {
			id,
			title: input.title,
			category: input.category,
			description: input.description,
			status: 'Open',
			studentId: input.studentId,
			student,
			createdAt: nowIso(),
			updatedAt: nowIso(),
			attachments,
			comments: []
		};
		grievances.push(grievance);
		return delay({ ok: true as const, data: clone(grievance) });
	}

	async updateStatus(id: string, status: GrievanceStatus): Promise<Result<Grievance>> {
		const g = grievances.find((x) => x.id === id);
		if (!g) {
			return delay({ ok: false as const, error: `Grievance ${id} was not found.` });
		}
		g.status = status;
		touch(g);
		return delay({ ok: true as const, data: clone(g) });
	}

	async delete(id: string): Promise<Result<void>> {
		const idx = grievances.findIndex((x) => x.id === id);
		if (idx !== -1) {
			grievances.splice(idx, 1);
		}
		return delay({ ok: true as const, data: undefined });
	}

	async submitReview(id: string, input: SubmitReviewInput): Promise<Result<Grievance>> {
		const g = grievances.find((x) => x.id === id);
		if (!g) {
			return delay({ ok: false as const, error: `Grievance ${id} was not found.` });
		}
		if (g.status !== 'Resolved') {
			return delay({ ok: false as const, error: 'Resolution reviews can only be submitted once the grievance is resolved.' });
		}
		const attId = `att-sol-${Date.now()}`;
		const solutionAttachment: Attachment = {
			id: attId,
			filename: input.file.name,
			sizeBytes: input.file.size,
			contentType: input.file.type || 'image/jpeg'
		};
		g.attachments.push(solutionAttachment);

		const review: ResolutionReview = {
			id: `rev-${Date.now()}`,
			grievanceId: g.id,
			studentId: g.studentId,
			student: g.student,
			rating: input.rating,
			feedback: input.feedback,
			attachmentId: attId,
			solutionAttachment,
			createdAt: nowIso()
		};
		g.review = review;
		touch(g);
		return delay({ ok: true as const, data: clone(g) });
	}

	async getReview(id: string): Promise<Result<ResolutionReview | null>> {
		const g = grievances.find((x) => x.id === id);
		if (!g) {
			return delay({ ok: false as const, error: `Grievance ${id} was not found.` });
		}
		return delay({ ok: true as const, data: g.review ? { ...g.review } : null });
	}

	async getStats(): Promise<Result<any>> {
		return delay({ ok: true as const, data: { total: grievances.length, open: 0, inProgress: 0, resolved: 0 } });
	}
}

class MockCommentService implements CommentService {
	private seq = 100;

	async add(grievanceId: string, authorId: string, body: string): Promise<Result<Comment>> {
		const g = grievances.find((x) => x.id === grievanceId);
		if (!g) {
			return delay({ ok: false as const, error: `Grievance ${grievanceId} was not found.` });
		}
		const author = MOCK_USERS[authorId];
		if (!author) {
			return delay({ ok: false as const, error: 'Unknown author.' });
		}
		this.seq += 1;
		const comment: Comment = {
			id: `cmt-${this.seq}`,
			grievanceId,
			authorId,
			author,
			body,
			createdAt: nowIso()
		};
		g.comments.push(comment);
		touch(g);
		return delay({ ok: true as const, data: { ...comment } });
	}
}

function clone(g: Grievance): Grievance {
	return {
		...g,
		attachments: g.attachments.map((a) => ({ ...a })),
		comments: g.comments.map((c) => ({ ...c, author: { ...c.author } }))
	};
}

import type {
	AuditLog,
	AuditLogStats,
	AuditLogFilters,
	AuditLogListResponse,
	AuditLogService
} from '$lib/services/types';

class MockAuditLogService implements AuditLogService {
	private logs: AuditLog[] = [
		{
			id: 'aud-1',
			eventType: 'user.created',
			action: 'System initialized administrator account',
			actorId: 'adm-1',
			actorName: 'Dr. S. K. Panda (Admin)',
			actorEmail: 'admin@example.test',
			actorRole: 'admin',
			targetId: 'adm-1',
			targetType: 'user',
			details: { role: 'admin', setup: true },
			ipAddress: '127.0.0.1',
			status: 'success',
			createdAt: '2026-08-01T08:00:00.000Z'
		},
		{
			id: 'aud-2',
			eventType: 'user.created',
			action: 'Warden registered student: Aarav Mehta',
			actorId: 'war-1',
			actorName: 'Mr. K. Sahu',
			actorEmail: 'warden@example.test',
			actorRole: 'warden',
			targetId: 'stu-1',
			targetType: 'user',
			details: { name: 'Aarav Mehta', email: 'student@example.test', room: 'B-204' },
			ipAddress: '192.168.1.45',
			status: 'success',
			createdAt: '2026-08-01T08:05:00.000Z'
		},
		{
			id: 'aud-3',
			eventType: 'auth.login_success',
			action: 'Signed in as student',
			actorId: 'stu-1',
			actorName: 'Aarav Mehta',
			actorEmail: 'student@example.test',
			actorRole: 'student',
			targetId: 'stu-1',
			targetType: 'user',
			details: { device: 'Mobile Safari' },
			ipAddress: '192.168.1.102',
			status: 'success',
			createdAt: '2026-08-13T09:10:00.000Z'
		},
		{
			id: 'aud-4',
			eventType: 'grievance.created',
			action: 'Filed complaint: Water leaking from bathroom ceiling',
			actorId: 'stu-1',
			actorName: 'Aarav Mehta',
			actorEmail: 'student@example.test',
			actorRole: 'student',
			targetId: 'GRV-0001',
			targetType: 'grievance',
			details: { category: 'Water', studentRoom: 'B-204' },
			ipAddress: '192.168.1.102',
			status: 'success',
			createdAt: '2026-08-13T09:15:00.000Z'
		},
		{
			id: 'aud-5',
			eventType: 'grievance.status_changed',
			action: 'Warden updated status to In Progress',
			actorId: 'war-1',
			actorName: 'Mr. K. Sahu',
			actorEmail: 'warden@example.test',
			actorRole: 'warden',
			targetId: 'GRV-0001',
			targetType: 'grievance',
			details: { grievanceTitle: 'Water leaking from bathroom ceiling', oldStatus: 'Open', newStatus: 'In Progress' },
			ipAddress: '192.168.1.45',
			status: 'success',
			createdAt: '2026-08-14T10:12:00.000Z'
		}
	];

	async list(filters: AuditLogFilters = {}): Promise<Result<AuditLogListResponse>> {
		let filtered = [...this.logs];
		if (filters.role && filters.role !== 'all') {
			filtered = filtered.filter((l) => l.actorRole === filters.role);
		}
		if (filters.status && filters.status !== 'all') {
			filtered = filtered.filter((l) => l.status === filters.status);
		}
		if (filters.search) {
			const q = filters.search.toLowerCase();
			filtered = filtered.filter((l) => l.action.toLowerCase().includes(q) || (l.actorName?.toLowerCase().includes(q)));
		}
		const page = filters.page ?? 1;
		const limit = filters.limit ?? 50;
		return delay({
			ok: true,
			data: {
				data: filtered.slice((page - 1) * limit, page * limit),
				total: filtered.length,
				page,
				limit,
				totalPages: Math.ceil(filtered.length / limit) || 1
			}
		});
	}

	async getStats(): Promise<Result<AuditLogStats>> {
		return delay({
			ok: true,
			data: {
				totalEvents: this.logs.length,
				studentEvents: this.logs.filter((l) => l.actorRole === 'student').length,
				wardenEvents: this.logs.filter((l) => l.actorRole === 'warden').length,
				adminEvents: this.logs.filter((l) => l.actorRole === 'admin').length,
				systemEvents: this.logs.filter((l) => l.actorRole === 'system').length,
				warningEvents: this.logs.filter((l) => l.status === 'warning' || l.status === 'failure').length,
				todayEvents: this.logs.length
			}
		});
	}

	async exportLogs(format: 'json' | 'csv' = 'json'): Promise<Result<string | AuditLog[]>> {
		if (format === 'csv') {
			return delay({ ok: true, data: 'id,action,actorRole\naud-1,Login,admin' });
		}
		return delay({ ok: true, data: [...this.logs] });
	}
}

export const authService: AuthService = new MockAuthService();
export const userService: UserService = new MockUserService();
export const grievanceService: GrievanceService = new MockGrievanceService();
export const commentService: CommentService = new MockCommentService();
export const auditLogService: AuditLogService = new MockAuditLogService();

