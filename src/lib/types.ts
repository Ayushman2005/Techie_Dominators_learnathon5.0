/**
 * HostelGrievance — domain types.
 * These mirror the shape the future Hono API will return.
 */

export type Role = 'student' | 'warden' | 'admin';

export type GrievanceStatus = 'Open' | 'In Progress' | 'Resolved';

export const GRIEVANCE_STATUSES: readonly GrievanceStatus[] = ['Open', 'In Progress', 'Resolved'];

export const GRIEVANCE_CATEGORIES = [
	'Maintenance',
	'Water',
	'Electricity',
	'Internet',
	'Cleanliness',
	'Room',
	'Other'
] as const;

export type GrievanceCategory = (typeof GRIEVANCE_CATEGORIES)[number];

export interface User {
	id: string;
	name: string;
	email: string;
	role: Role;
	/** For students: hostel room identifier shown to wardens. */
	room?: string;
	createdAt?: string;
}

export interface CreateUserInput {
	name: string;
	email: string;
	password: string;
	role: Role;
	room?: string;
}

export interface UpdateUserInput {
	name?: string;
	email?: string;
	password?: string;
	role?: Role;
	room?: string;
}

export interface Attachment {
	id: string;
	filename: string;
	sizeBytes: number;
	/** MIME type; the backend will later enforce allowed types authoritatively. */
	contentType: string;
}

export interface Comment {
	id: string;
	grievanceId: string;
	authorId: string;
	/** Denormalized for convenient display; API will provide this. */
	author: User;
	body: string;
	createdAt: string; // ISO timestamp
}

export interface Grievance {
	id: string;
	title: string;
	description: string;
	category: GrievanceCategory;
	status: GrievanceStatus;
	studentId: string;
	/** Denormalized for warden list display. */
	student: User;
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
	attachments: Attachment[];
	comments: Comment[];
}

/** Result of a mock sign-in attempt. */
export type AuthResult =
	| { ok: true; user: User }
	| { ok: false; error: string };

/** Result wrapper for operations that can fail generically. */
export type Result<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };

export type AuditLogRole = Role | 'system';
export type AuditLogStatus = 'success' | 'failure' | 'warning' | 'info';

export interface AuditLog {
	id: string;
	eventType: string;
	action: string;
	actorId?: string;
	actorName?: string;
	actorEmail?: string;
	actorRole: AuditLogRole;
	targetId?: string;
	targetType?: string;
	details?: Record<string, unknown>;
	ipAddress?: string;
	status: AuditLogStatus;
	createdAt: string;
}

export interface AuditLogStats {
	totalEvents: number;
	studentEvents: number;
	wardenEvents: number;
	adminEvents: number;
	systemEvents: number;
	warningEvents: number;
	todayEvents: number;
}

export interface AuditLogFilters {
	role?: AuditLogRole | 'all';
	eventType?: string;
	status?: AuditLogStatus | 'all';
	search?: string;
	page?: number;
	limit?: number;
}

export interface AuditLogListResponse {
	data: AuditLog[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

