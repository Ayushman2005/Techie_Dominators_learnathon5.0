export type Role = 'student' | 'warden' | 'admin';

export type GrievanceStatusDb = 'open' | 'in_progress' | 'resolved';

/** Status strings the Svelte UI already uses. */
export type GrievanceStatusUi = 'Open' | 'In Progress' | 'Resolved';

export type GrievanceCategory =
	| 'Maintenance'
	| 'Water'
	| 'Electricity'
	| 'Internet'
	| 'Cleanliness'
	| 'Room'
	| 'Other';

export interface PublicUser {
	id: string;
	name: string;
	email: string;
	role: Role;
	room?: string;
	rollNo?: string | null;
	empId?: string | null;
	wardenId?: string | null;
	warden?: PublicUser | null;
}

export interface PublicAttachment {
	id: string;
	filename: string;
	sizeBytes: number;
	contentType: string;
}

export interface PublicComment {
	id: string;
	grievanceId: string;
	authorId: string;
	author: PublicUser;
	body: string;
	createdAt: string;
}

export interface PublicResolutionReview {
	id: string;
	grievanceId: string;
	studentId: string;
	student?: PublicUser;
	rating: number;
	feedback: string;
	attachmentId?: string | null;
	solutionAttachment?: PublicAttachment | null;
	createdAt: string;
}

export interface PublicGrievance {
	id: string;
	title: string;
	description: string;
	category: GrievanceCategory;
	status: GrievanceStatusUi;
	studentId: string;
	student: PublicUser;
	createdAt: string;
	updatedAt: string;
	attachments: PublicAttachment[];
	comments: PublicComment[];
	review?: PublicResolutionReview | null;
}

export interface ResolutionReviewRow {
	id: string;
	grievance_id: string;
	student_id: string;
	rating: number;
	feedback: string;
	attachment_id: string | null;
	created_at: string;
}

export interface UserRow {
	id: string;
	name: string;
	email: string;
	password_hash: string;
	role: Role;
	room: string | null;
	roll_no: string | null;
	emp_id: string | null;
	warden_id: string | null;
	created_at: string;
}

export interface GrievanceRow {
	id: string;
	student_id: string;
	title: string;
	category: string;
	description: string;
	status: GrievanceStatusDb;
	created_at: string;
	updated_at: string;
}

export interface CommentRow {
	id: string;
	grievance_id: string;
	author_id: string;
	body: string;
	created_at: string;
}

export interface AttachmentRow {
	id: string;
	grievance_id: string;
	original_filename: string;
	stored_filename: string;
	mime_type: string;
	size_bytes: number;
	data?: Buffer | Uint8Array | null;
	created_at: string;
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: Role;
	room: string | null;
	created_at: string;
}

export type ErrorCode =
	| 'bad_request'
	| 'unauthenticated'
	| 'unauthorized'
	| 'not_found'
	| 'conflict'
	| 'internal';

export type AuditLogRole = Role | 'system';
export type AuditLogStatus = 'success' | 'failure' | 'warning' | 'info';

export interface AuditLogRow {
	id: string;
	event_type: string;
	action: string;
	actor_id: string | null;
	actor_name: string | null;
	actor_email: string | null;
	actor_role: AuditLogRole;
	target_id: string | null;
	target_type: string | null;
	details: string | null;
	ip_address: string | null;
	status: AuditLogStatus;
	created_at: string;
}

export interface PublicAuditLog {
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

