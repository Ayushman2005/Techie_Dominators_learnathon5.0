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
	room?: string | null;
	rollNo?: string | null;
	studentId?: string | null;
	empId?: string | null;
	wardenId?: string | null;
	warden?: User | null;
	createdAt?: string;
}

export interface CreateUserInput {
	name: string;
	email: string;
	password: string;
	role: Role;
	room?: string;
	studentId?: string;
	rollNo?: string;
	empId?: string;
	wardenId?: string;
}

export interface UpdateUserInput {
	name?: string;
	email?: string;
	password?: string;
	role?: Role;
	room?: string;
	studentId?: string;
	rollNo?: string;
	empId?: string;
	wardenId?: string;
}

export interface Attachment {
	id: string;
	filename: string;
	sizeBytes: number;
	contentType: string;
}

export interface Comment {
	id: string;
	grievanceId: string;
	authorId: string;
	author: User;
	body: string;
	createdAt: string;
}

export interface ResolutionReview {
	id: string;
	grievanceId: string;
	studentId: string;
	student?: User;
	rating: number;
	feedback: string;
	attachmentId?: string | null;
	solutionAttachment?: Attachment | null;
	createdAt: string;
}

export interface Grievance {
	id: string;
	title: string;
	description: string;
	category: GrievanceCategory;
	status: GrievanceStatus;
	studentId: string;
	student: User;
	createdAt: string;
	updatedAt: string;
	attachments: Attachment[];
	comments: Comment[];
	review?: ResolutionReview | null;
}

export type AuthResult =
	| { ok: true; user: User }
	| { ok: false; error: string };

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

