/**
 * Frontend service contracts — the only seam the future Hono API needs to implement.
 * UI components never import mock data directly; they go through these interfaces.
 */
import type {
	Attachment,
	AuthResult,
	Comment,
	CreateUserInput,
	Grievance,
	GrievanceCategory,
	GrievanceStatus,
	Result,
	Role,
	UpdateUserInput,
	User,
	AuditLog,
	AuditLogStats,
	AuditLogFilters,
	AuditLogListResponse
} from '$lib/types';

export interface AttachmentInput {
	filename: string;
	sizeBytes: number;
	contentType: string;
	/** Present when filing against the live API; ignored by the in-memory mock. */
	file?: File;
}

export interface CreateGrievanceInput {
	studentId: string;
	title: string;
	category: GrievanceCategory;
	description: string;
	attachment?: AttachmentInput | null;
}

export interface AuthService {
	/** Validate credentials and return the session user (mock-only). */
	signIn(email: string, password: string): Promise<AuthResult>;
	/** End the session. */
	signOut(): Promise<void>;
	/**
	 * Restore a persisted session synchronously (mock: localStorage).
	 * A real cookie-session API can expose an async hydration path instead;
	 * the UI layer does not depend on how this is implemented.
	 */
	restore(): User | null;
}

export interface UserStats {
	student: number;
	warden: number;
	admin: number;
	total: number;
}

export interface UserService {
	list(role?: Role): Promise<Result<User[]>>;
	getById(id: string): Promise<User | null>;
	create(input: CreateUserInput): Promise<Result<User>>;
	update(id: string, input: UpdateUserInput): Promise<Result<User>>;
	delete(id: string): Promise<Result<void>>;
	getStats(): Promise<Result<UserStats>>;
}

export interface GrievanceService {
	/** All grievances belonging to one student. */
	listForStudent(studentId: string): Promise<Result<Grievance[]>>;
	/** All grievances across students (warden / admin view). */
	listAll(): Promise<Result<Grievance[]>>;
	/** Single grievance by ID, or error when missing. */
	getById(id: string): Promise<Result<Grievance>>;
	create(input: CreateGrievanceInput): Promise<Result<Grievance>>;
	updateStatus(id: string, status: GrievanceStatus): Promise<Result<Grievance>>;
	delete(id: string): Promise<Result<void>>;
}

export interface CommentService {
	add(grievanceId: string, authorId: string, body: string): Promise<Result<Comment>>;
}

export interface AuditLogService {
	list(filters?: AuditLogFilters): Promise<Result<AuditLogListResponse>>;
	getStats(): Promise<Result<AuditLogStats>>;
	exportLogs(format?: 'json' | 'csv', filters?: AuditLogFilters): Promise<Result<string | AuditLog[]>>;
}

export type { Attachment, AuthResult, Comment, Grievance, GrievanceStatus, Result, User, AuditLog, AuditLogStats, AuditLogFilters, AuditLogListResponse };

