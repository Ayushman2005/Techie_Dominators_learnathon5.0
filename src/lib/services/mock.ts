/**
 * Mock implementation of the service layer.
 * In-memory store, deterministic IDs, small artificial latency so
 * loading states are real and testable. Swap this module for a Hono
 * API client later without touching any UI code.
 */
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

/**
 * Module-level store. In SvelteKit this survives client-side navigation.
 * Session identity is mirrored to localStorage for restore().
 */
const grievances: Grievance[] = buildSeedGrievances();

function nextGrievanceId(): string {
	const nums = grievances
		.map((g) => Number.parseInt(g.id.replace('GRV-', ''), 10))
		.filter((n) => !Number.isNaN(n));
	const max = nums.length ? Math.max(...nums) : 0;
	return `GRV-${String(max + 1).padStart(4, '0')}`;
}

function nowIso(): string {
	// Deterministic "current time" for the mock; the API will use real time.
	return MOCK_NOW;
}

function touch(g: Grievance): void {
	g.updatedAt = nowIso();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

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
			// localStorage unavailable — session lives in memory only.
		}
		return delay({ ok: true as const, user });
	}

	async signOut(): Promise<void> {
		this.currentUser = null;
		try {
			localStorage.removeItem(SESSION_KEY);
		} catch {
			/* ignore */
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

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

class MockUserService implements UserService {
	async list(role?: Role): Promise<Result<User[]>> {
		let list = Object.values(MOCK_USERS);
		if (role) list = list.filter((u) => u.role === role);
		return delay({ ok: true as const, data: list.map((u) => ({ ...u })) });
	}

	async getById(id: string): Promise<User | null> {
		return delay(MOCK_USERS[id] ?? null, 80);
	}

	async create(input: CreateUserInput): Promise<Result<User>> {
		const newId = `usr-${Date.now()}`;
		const user: User = {
			id: newId,
			name: input.name,
			email: input.email,
			role: input.role,
			room: input.room,
			createdAt: nowIso()
		};
		MOCK_USERS[newId] = user;
		return delay({ ok: true as const, data: { ...user } });
	}

	async update(id: string, input: UpdateUserInput): Promise<Result<User>> {
		const user = MOCK_USERS[id];
		if (!user) return delay({ ok: false as const, error: 'User not found.' });
		if (input.name) user.name = input.name;
		if (input.email) user.email = input.email;
		if (input.role) user.role = input.role;
		if (input.room !== undefined) user.room = input.room;
		return delay({ ok: true as const, data: { ...user } });
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
}

// ---------------------------------------------------------------------------
// Grievances
// ---------------------------------------------------------------------------

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
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

export const authService: AuthService = new MockAuthService();
export const userService: UserService = new MockUserService();
export const grievanceService: GrievanceService = new MockGrievanceService();
export const commentService: CommentService = new MockCommentService();
