import type {
	Attachment,
	AuthResult,
	Comment,
	CreateUserInput,
	Grievance,
	GrievanceCategory,
	GrievanceStatus,
	ResolutionReview,
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
	file?: File;
}

export interface CreateGrievanceInput {
	studentId: string;
	title: string;
	category: GrievanceCategory;
	description: string;
	attachment?: AttachmentInput | null;
}

export interface SubmitReviewInput {
	rating: number;
	feedback: string;
	file: File;
}

export interface AuthService {
	signIn(email: string, password: string): Promise<AuthResult>;
	signOut(): Promise<void>;
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
	listWardens(): Promise<Result<User[]>>;
	getById(id: string): Promise<User | null>;
	create(input: CreateUserInput): Promise<Result<User>>;
	update(id: string, input: UpdateUserInput): Promise<Result<User>>;
	delete(id: string): Promise<Result<void>>;
	getStats(): Promise<Result<UserStats>>;
}

export interface GrievanceService {
	listForStudent(studentId: string): Promise<Result<Grievance[]>>;
	listAll(): Promise<Result<Grievance[]>>;
	getById(id: string): Promise<Result<Grievance>>;
	create(input: CreateGrievanceInput): Promise<Result<Grievance>>;
	updateStatus(id: string, status: GrievanceStatus): Promise<Result<Grievance>>;
	delete(id: string): Promise<Result<void>>;
	submitReview(id: string, input: SubmitReviewInput): Promise<Result<Grievance>>;
	getReview(id: string): Promise<Result<ResolutionReview | null>>;
}

export interface CommentService {
	add(grievanceId: string, authorId: string, body: string): Promise<Result<Comment>>;
}

export interface AuditLogService {
	list(filters?: AuditLogFilters): Promise<Result<AuditLogListResponse>>;
	getStats(): Promise<Result<AuditLogStats>>;
	exportLogs(format?: 'json' | 'csv', filters?: AuditLogFilters): Promise<Result<string | AuditLog[]>>;
}

export type {
	Attachment,
	AuthResult,
	Comment,
	Grievance,
	GrievanceStatus,
	ResolutionReview,
	Result,
	User,
	AuditLog,
	AuditLogStats,
	AuditLogFilters,
	AuditLogListResponse
};

