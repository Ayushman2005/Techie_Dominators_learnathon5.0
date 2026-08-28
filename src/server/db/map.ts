import { statusToUi } from '../http/status.ts';
import type {
	AttachmentRow,
	CommentRow,
	GrievanceCategory,
	AuditLogRow,
	PublicAuditLog,
	PublicAttachment,
	PublicComment,
	PublicGrievance,
	PublicResolutionReview,
	ResolutionReviewRow,
	PublicUser,
	GrievanceRow,
	UserRow
} from '../types/index.ts';

export function toPublicUser(
	row: Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'room'> & Partial<Pick<UserRow, 'roll_no' | 'emp_id' | 'warden_id'>>,
	warden?: PublicUser | null
): PublicUser {
	const user: PublicUser = {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role
	};
	if (row.room !== undefined && row.room !== null) {
		user.room = row.room;
	}
	if (row.roll_no !== undefined) {
		user.rollNo = row.roll_no;
	}
	if (row.emp_id !== undefined) {
		user.empId = row.emp_id;
	}
	if (row.warden_id !== undefined) {
		user.wardenId = row.warden_id;
	}
	if (warden !== undefined) {
		user.warden = warden;
	}
	return user;
}

export function toPublicAttachment(row: AttachmentRow): PublicAttachment {
	return {
		id: row.id,
		filename: row.original_filename,
		sizeBytes: row.size_bytes,
		contentType: row.mime_type
	};
}

export function toPublicComment(row: CommentRow, author: PublicUser): PublicComment {
	return {
		id: row.id,
		grievanceId: row.grievance_id,
		authorId: row.author_id,
		author,
		body: row.body,
		createdAt: row.created_at
	};
}

export function toPublicResolutionReview(
	row: ResolutionReviewRow,
	student?: PublicUser,
	solutionAttachment?: PublicAttachment | null
): PublicResolutionReview {
	return {
		id: row.id,
		grievanceId: row.grievance_id,
		studentId: row.student_id,
		student,
		rating: row.rating,
		feedback: row.feedback,
		attachmentId: row.attachment_id,
		solutionAttachment,
		createdAt: row.created_at
	};
}

export function toPublicGrievance(
	row: GrievanceRow,
	student: PublicUser,
	attachments: PublicAttachment[],
	comments: PublicComment[],
	review?: PublicResolutionReview | null
): PublicGrievance {
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		category: row.category as GrievanceCategory,
		status: statusToUi(row.status),
		studentId: row.student_id,
		student,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		attachments,
		comments,
		review: review ?? null
	};
}

export function toPublicAuditLog(row: AuditLogRow): PublicAuditLog {
	let parsedDetails: Record<string, unknown> | undefined;
	if (row.details) {
		try {
			parsedDetails = JSON.parse(row.details);
		} catch {
			parsedDetails = { raw: row.details };
		}
	}

	return {
		id: row.id,
		eventType: row.event_type,
		action: row.action,
		actorId: row.actor_id ?? undefined,
		actorName: row.actor_name ?? undefined,
		actorEmail: row.actor_email ?? undefined,
		actorRole: row.actor_role,
		targetId: row.target_id ?? undefined,
		targetType: row.target_type ?? undefined,
		details: parsedDetails,
		ipAddress: row.ip_address ?? undefined,
		status: row.status,
		createdAt: row.created_at
	};
}

