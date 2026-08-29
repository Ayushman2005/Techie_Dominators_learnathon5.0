export type Role = 'student' | 'warden' | 'admin';

export interface Hostel {
	id: string;
	name: string;
	createdAt?: string;
}

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
	phone?: string | null;
	emergencyContact?: string | null;
	wardenId?: string | null;
	warden?: User | null;
	/** The hostel this user belongs to */
	hostelId?: string | null;
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
	hostelId?: string;
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
	hostelId?: string;
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
	priority?: string;
	studentId: string;
	student: User;
	availableTime?: string | null;
	createdAt: string; // ISO timestamp
	updatedAt: string; // ISO timestamp
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

export interface Notice {
	id: string;
	author_id: string;
	author_name: string;
	author_role: Role;
	title: string;
	body: string;
	hostel_id: string | null;
	created_at: string;
}

export interface CreateNoticeInput {
	title: string;
	body: string;
	hostel_id: string | null;
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

export interface MonthlyVolume {
	month: string; // "YYYY-MM"
	count: number;
}

export interface WardenPerformance {
	wardenId: string;
	wardenName: string;
	wardenEmpId: string | null;
	totalGrievances: number;
	resolved: number;
	open: number;
	inProgress: number;
	resolutionRatePct: number;
	avgResolutionHours: number | null;
}

export interface GrievanceAnalytics {
	totalGrievances: number;
	resolved: number;
	open: number;
	inProgress: number;
	resolutionRatePct: number;
	avgResolutionHours: number | null;
	overdueCount: number;
	byCategory: Record<string, number>;
	byPriority: Record<string, number>;
	monthlyVolume: MonthlyVolume[];
	wardenPerformance: WardenPerformance[];
}
