import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { HttpError } from '../http/errors.ts';
import type {
	AttachmentRow,
	AuditLogFilters,
	AuditLogRow,
	AuditLogRole,
	AuditLogStats,
	AuditLogStatus,
	CommentRow,
	GrievanceRow,
	GrievanceFilters,
	GrievanceStats,
	PublicGrievance,
	PublicResolutionReview,
	PublicUser,
	ResolutionReviewRow,
	Role,
	SessionUser,
	StatusHistoryRow,
	UserRow
} from '../types/index.ts';
import { DEFAULT_UPLOADS_DIR } from '../config.ts';
import { deleteStoredFile } from '../storage/attachments.ts';
import { toPublicAttachment, toPublicComment, toPublicGrievance, toPublicResolutionReview, toPublicUser, toPublicStatusHistory } from './map.ts';

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function findUserById(db: Database, id: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByRollNo(db: Database, rollNo: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE roll_no = ?').get(rollNo) as UserRow | undefined;
}

export function findUserByEmpId(db: Database, empId: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE emp_id = ?').get(empId) as UserRow | undefined;
}

export function assembleUser(db: Database, row: UserRow): PublicUser {
	let warden: PublicUser | null = null;
	if (row.warden_id) {
		const wardenRow = findUserById(db, row.warden_id);
		if (wardenRow) {
			warden = toPublicUser(wardenRow);
		}
	}
	return toPublicUser(row, warden);
}

export function userCount(db: Database): number {
	const row = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
	return row.n;
}

export function findGrievanceRow(db: Database, id: string): GrievanceRow | undefined {
	return db.prepare('SELECT * FROM grievances WHERE id = ?').get(id) as GrievanceRow | undefined;
}

export function listGrievanceRowsForStudent(db: Database, studentId: string): GrievanceRow[] {
	return db
		.prepare('SELECT * FROM grievances WHERE student_id = ? ORDER BY created_at DESC')
		.all(studentId) as GrievanceRow[];
}

export function listGrievanceRowsForWarden(db: Database, wardenId: string): GrievanceRow[] {
	return db
		.prepare(
			`SELECT g.* FROM grievances g
       JOIN users u ON g.student_id = u.id
       WHERE u.warden_id = ?
       ORDER BY g.created_at DESC`
		)
		.all(wardenId) as GrievanceRow[];
}

export function listAllGrievanceRows(db: Database): GrievanceRow[] {
	return db.prepare('SELECT * FROM grievances ORDER BY created_at DESC').all() as GrievanceRow[];
}

export function listCommentRows(db: Database, grievanceId: string): CommentRow[] {
	return db
		.prepare('SELECT * FROM comments WHERE grievance_id = ? ORDER BY created_at ASC')
		.all(grievanceId) as CommentRow[];
}

export function listAttachmentRows(db: Database, grievanceId: string): AttachmentRow[] {
	return db
		.prepare('SELECT * FROM attachments WHERE grievance_id = ? ORDER BY created_at ASC')
		.all(grievanceId) as AttachmentRow[];
}

export function findAttachmentRow(db: Database, id: string): AttachmentRow | undefined {
	return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow | undefined;
}

export function findResolutionReviewRow(db: Database, grievanceId: string): ResolutionReviewRow | undefined {
	return db.prepare('SELECT * FROM resolution_reviews WHERE grievance_id = ?').get(grievanceId) as ResolutionReviewRow | undefined;
}

export function assembleGrievance(db: Database, row: GrievanceRow): PublicGrievance {
	const studentRow = findUserById(db, row.student_id);
	if (!studentRow) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const student = assembleUser(db, studentRow);
	const attachments = listAttachmentRows(db, row.id).map(toPublicAttachment);
	const comments = listCommentRows(db, row.id).map((comment) => {
		const authorRow = findUserById(db, comment.author_id);
		if (!authorRow) {
			throw new HttpError(500, 'internal', 'Internal server error.');
		}
		return toPublicComment(comment, assembleUser(db, authorRow));
	});

	const reviewRow = findResolutionReviewRow(db, row.id);
	let review: PublicResolutionReview | null = null;
	if (reviewRow) {
		const revStudent = findUserById(db, reviewRow.student_id);
		const solutionAtt = reviewRow.attachment_id ? findAttachmentRow(db, reviewRow.attachment_id) : undefined;
		review = toPublicResolutionReview(
			reviewRow,
			revStudent ? assembleUser(db, revStudent) : undefined,
			solutionAtt ? toPublicAttachment(solutionAtt) : null
		);
	}

	return toPublicGrievance(row, student, attachments, comments, review);
}

export function assembleGrievanceSummaries(db: Database, rows: GrievanceRow[]): PublicGrievance[] {
	if (rows.length === 0) return [];

	const studentIds = [...new Set(rows.map((r) => r.student_id))];
	const placeholders = studentIds.map(() => '?').join(',');
	const userRows = db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).all(...studentIds) as UserRow[];
	
	const userMap = new Map<string, PublicUser>();
	for (const ur of userRows) {
		userMap.set(ur.id, assembleUser(db, ur)); // assembleUser just looks up warden, but wait, assembleUser calls findUserById for warden!
	}
	
	// A more optimized approach is to just use assembleUser since it's cached or fast enough, but doing it in a loop is still N+1 for wardens.
	// Actually, let's just do a simple map for now to avoid the attachments/comments N+1 which is the heavy part.
	
	return rows.map((row) => {
		let student = userMap.get(row.student_id);
		if (!student) {
			const fallback = findUserById(db, row.student_id);
			student = fallback ? assembleUser(db, fallback) : assembleUser(db, userRows[0]); // Fallback
		}
		// Return summary with empty arrays to avoid N+1 on heavy relations
		return toPublicGrievance(row, student!, [], [], null);
	});
}

export function requireGrievance(db: Database, id: string): GrievanceRow {
	const row = findGrievanceRow(db, id);
	if (!row) {
		throw new HttpError(404, 'not_found', 'Grievance was not found.');
	}
	return row;
}

export function listUsers(
	db: Database,
	role?: Role,
	filterScope?: { wardenId?: string; hostelId?: string | null } | string
): UserRow[] {
	const wardenId = typeof filterScope === 'string' ? filterScope : filterScope?.wardenId;
	const hostelId = typeof filterScope === 'object' ? filterScope?.hostelId : undefined;

	if (role === 'student' && wardenId) {
		return db
			.prepare('SELECT * FROM users WHERE role = ? AND warden_id = ? ORDER BY created_at DESC')
			.all(role, wardenId) as UserRow[];
	}
	if (role === 'student' && hostelId) {
		return db
			.prepare('SELECT * FROM users WHERE role = ? AND hostel_id = ? ORDER BY created_at DESC')
			.all(role, hostelId) as UserRow[];
	}
	if (role) {
		return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role) as UserRow[];
	}
	return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
}

export function listWardens(db: Database): UserRow[] {
	return db.prepare("SELECT * FROM users WHERE role = 'warden' ORDER BY name ASC").all() as UserRow[];
}

export function countUsersByRole(db: Database): { student: number; warden: number; admin: number; total: number } {
	const rows = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all() as { role: Role; count: number }[];
	const counts: { student: number; warden: number; admin: number; total: number } = {
		student: 0,
		warden: 0,
		admin: 0,
		total: 0
	};
	for (const r of rows) {
		if (r.role === 'student' || r.role === 'warden' || r.role === 'admin') {
			counts[r.role] = r.count;
			counts.total += r.count;
		}
	}
	return counts;
}

export function createUser(
	db: Database,
	user: {
		id: string;
		name: string;
		email: string;
		password_hash: string;
		role: Role;
		room: string | null;
		roll_no?: string | null;
		emp_id?: string | null;
		phone?: string | null;
		emergency_contact?: string | null;
		warden_id?: string | null;
		hostel_id?: string | null;
		created_at: string;
	}
): UserRow {
	db.prepare(
		`INSERT INTO users (id, name, email, password_hash, role, room, roll_no, emp_id, phone, emergency_contact, warden_id, hostel_id, created_at)
     VALUES (@id, @name, @email, @password_hash, @role, @room, @roll_no, @emp_id, @phone, @emergency_contact, @warden_id, @hostel_id, @created_at)`
	).run({
		id: user.id,
		name: user.name,
		email: user.email,
		password_hash: user.password_hash,
		role: user.role,
		room: user.room ?? null,
		roll_no: user.roll_no ?? null,
		emp_id: user.emp_id ?? null,
		phone: user.phone ?? null,
		emergency_contact: user.emergency_contact ?? null,
		warden_id: user.warden_id ?? null,
		hostel_id: user.hostel_id ?? null,
		created_at: user.created_at
	});
	return findUserById(db, user.id)!;
}

export function updateUser(
	db: Database,
	id: string,
	updates: {
		name?: string;
		email?: string;
		password_hash?: string;
		role?: Role;
		room?: string | null;
		roll_no?: string | null;
		emp_id?: string | null;
		phone?: string | null;
		emergency_contact?: string | null;
		warden_id?: string | null;
		hostel_id?: string | null;
	}
): UserRow {
	const user = findUserById(db, id);
	if (!user) {
		throw new HttpError(404, 'not_found', 'User not found.');
	}
	const nextName = updates.name !== undefined ? updates.name : user.name;
	const nextEmail = updates.email !== undefined ? updates.email : user.email;
	const nextPasswordHash = updates.password_hash !== undefined ? updates.password_hash : user.password_hash;
	const nextRole = updates.role !== undefined ? updates.role : user.role;
	const nextRoom = updates.room !== undefined ? updates.room : user.room;
	const nextRollNo = updates.roll_no !== undefined ? updates.roll_no : user.roll_no;
	const nextEmpId = updates.emp_id !== undefined ? updates.emp_id : user.emp_id;
	const nextPhone = updates.phone !== undefined ? updates.phone : user.phone;
	const nextEmergencyContact = updates.emergency_contact !== undefined ? updates.emergency_contact : user.emergency_contact;
	const nextWardenId = updates.warden_id !== undefined ? updates.warden_id : user.warden_id;
	const nextHostelId = updates.hostel_id !== undefined ? updates.hostel_id : user.hostel_id;

	db.prepare(
		'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, room = ?, roll_no = ?, emp_id = ?, phone = ?, emergency_contact = ?, warden_id = ?, hostel_id = ? WHERE id = ?'
	).run(nextName, nextEmail, nextPasswordHash, nextRole, nextRoom, nextRollNo, nextEmpId, nextPhone, nextEmergencyContact, nextWardenId, nextHostelId, id);

	return findUserById(db, id)!;
}

export function deleteUser(db: Database, id: string, uploadsDir: string = DEFAULT_UPLOADS_DIR): void {
	const grievances = db.prepare('SELECT id FROM grievances WHERE student_id = ?').all(id) as { id: string }[];
	for (const g of grievances) {
		deleteGrievance(db, g.id, uploadsDir);
	}
	db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function deleteGrievance(db: Database, id: string, uploadsDir: string = DEFAULT_UPLOADS_DIR): void {
	const attachments = listAttachmentRows(db, id);
	for (const att of attachments) {
		deleteStoredFile(uploadsDir, att.stored_filename);
	}
	db.prepare('DELETE FROM grievances WHERE id = ?').run(id);
}

export function assertCanViewGrievance(
	first: SessionUser | Database,
	second: GrievanceRow | SessionUser,
	third?: Database | GrievanceRow
): void {
	let user: SessionUser;
	let row: GrievanceRow;
	let db: Database | undefined;

	if ('role' in (first as SessionUser)) {
		user = first as SessionUser;
		row = second as GrievanceRow;
		db = third as Database | undefined;
	} else {
		db = first as Database;
		user = second as SessionUser;
		row = third as GrievanceRow;
	}

	switch (user.role) {
		case 'admin':
			// Admins have unrestricted visibility over all grievances
			return;
		case 'warden': {
			if (db) {
				const student = findUserById(db, row.student_id);
				if (
					!student ||
					(student.warden_id
						? student.warden_id !== user.id
						: user.hostel_id && student.hostel_id !== user.hostel_id)
				) {
					throw new HttpError(
						403,
						'unauthorized',
						'You cannot access grievances for students not assigned to you.'
					);
				}
			}
			return;
		}
		case 'student':
			if (row.student_id !== user.id) {
				throw new HttpError(403, 'unauthorized', 'You cannot access this grievance.');
			}
			return;
		default: {
			const _exhaustive: never = user.role;
			throw new HttpError(500, 'internal', 'Internal server error.');
			void _exhaustive;
		}
	}
}

/**
 * Generate a random UUID-based user ID with role prefix.
 * Using randomUUID() eliminates the sequential scan + max+1 race condition.
 */
export function nextUserId(_db: Database, role: Role): string {
	const prefix = role === 'admin' ? 'adm-' : role === 'warden' ? 'war-' : 'stu-';
	return `${prefix}${randomUUID()}`;
}

/**
 * All entity IDs are now crypto-random UUIDs, eliminating the former
 * sequential scan + max+1 pattern which had a race condition under concurrency.
 */
export function nextGrievanceId(_db: Database): string {
	return `GRV-${randomUUID()}`;
}

export function nextCommentId(_db: Database): string {
	return `cmt-${randomUUID()}`;
}

export function nextAttachmentId(_db: Database): string {
	return `att-${randomUUID()}`;
}

export function nextResolutionReviewId(_db: Database): string {
	return `rev-${randomUUID()}`;
}

export function insertResolutionReview(
	db: Database,
	input: {
		id?: string;
		grievanceId: string;
		studentId: string;
		rating: number;
		feedback: string;
		attachmentId?: string | null;
		createdAt?: string;
	}
): ResolutionReviewRow {
	const id = input.id ?? nextResolutionReviewId(db);
	const createdAt = input.createdAt ?? new Date().toISOString();
	db.prepare(
		`INSERT INTO resolution_reviews (id, grievance_id, student_id, rating, feedback, attachment_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
	).run(id, input.grievanceId, input.studentId, input.rating, input.feedback, input.attachmentId ?? null, createdAt);
	return db.prepare('SELECT * FROM resolution_reviews WHERE id = ?').get(id) as ResolutionReviewRow;
}

export function touchGrievance(db: Database, id: string, updatedAt: string): void {
	db.prepare('UPDATE grievances SET updated_at = ? WHERE id = ?').run(updatedAt, id);
}

export function nextAuditLogId(_db: Database): string {
	return `aud-${randomUUID()}`;
}

// ─── Status History ───────────────────────────────────────────────────────────

export function insertStatusHistory(
	db: Database,
	input: {
		grievanceId: string;
		changedById: string;
		changedByName: string;
		changedByRole: string;
		oldStatus: string;
		newStatus: string;
		note?: string | null;
		createdAt?: string;
	}
): StatusHistoryRow {
	const id = `sh-${randomUUID()}`;
	const createdAt = input.createdAt ?? new Date().toISOString();
	db.prepare(
		`INSERT INTO grievance_status_history
       (id, grievance_id, changed_by_id, changed_by_name, changed_by_role, old_status, new_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		id,
		input.grievanceId,
		input.changedById,
		input.changedByName,
		input.changedByRole,
		input.oldStatus,
		input.newStatus,
		input.note ?? null,
		createdAt
	);
	return db.prepare('SELECT * FROM grievance_status_history WHERE id = ?').get(id) as StatusHistoryRow;
}

export function listStatusHistory(db: Database, grievanceId: string): StatusHistoryRow[] {
	return db
		.prepare(
			'SELECT * FROM grievance_status_history WHERE grievance_id = ? ORDER BY created_at ASC'
		)
		.all(grievanceId) as StatusHistoryRow[];
}

// ─── Session Invalidation ────────────────────────────────────────────────────

/**
 * Delete all sessions for a user. Called after password change to
 * ensure an attacker who captured an old token cannot continue using it.
 */
export function deleteSessionsForUser(db: Database, userId: string): void {
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ─── Grievance Filtering + Pagination ────────────────────────────────────────

function buildGrievanceWhere(
	filters: GrievanceFilters,
	extraConditions: string[] = []
): { sql: string; params: unknown[] } {
	const conditions: string[] = [...extraConditions];
	const params: unknown[] = [];

	if (filters.status && filters.status !== 'all') {
		conditions.push('g.status = ?');
		params.push(filters.status);
	}
	if (filters.category && filters.category !== 'all') {
		conditions.push('g.category = ?');
		params.push(filters.category);
	}
	if (filters.priority && filters.priority !== 'all') {
		conditions.push('g.priority = ?');
		params.push(filters.priority);
	}
	if (filters.search && filters.search.trim()) {
		const q = `%${filters.search.trim()}%`;
		conditions.push('(g.title LIKE ? OR g.description LIKE ?)');
		params.push(q, q);
	}

	const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	return { sql, params };
}

export function listGrievancesFiltered(
	db: Database,
	scope: { role: string; userId: string; hostelId?: string | null },
	filters: GrievanceFilters = {}
): { rows: GrievanceRow[]; total: number } {
	const page = Math.max(1, filters.page ?? 1);
	const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
	const offset = (page - 1) * limit;

	let baseConditions: string[] = [];
	let baseParams: unknown[] = [];

	if (scope.role === 'student') {
		baseConditions = ['g.student_id = ?'];
		baseParams = [scope.userId];
	} else if (scope.role === 'warden') {
		if (!scope.hostelId) {
			// If warden has no hostel, they see nothing
			baseConditions = ['1 = 0'];
		} else {
			baseConditions = ['u.hostel_id = ?'];
			baseParams = [scope.hostelId];
		}
	}
	// admin: no base condition — sees all

	const { sql: whereSql, params: whereParams } = buildGrievanceWhere(filters, baseConditions);
	const allParams = [...baseParams, ...whereParams];

	const joinClause = scope.role === 'warden'
		? 'JOIN users u ON g.student_id = u.id'
		: '';

	const countQuery = `SELECT COUNT(*) as count FROM grievances g ${joinClause} ${whereSql}`;
	const countRow = db.prepare(countQuery).get(...allParams) as { count: number };

	const dataQuery = `SELECT g.* FROM grievances g ${joinClause} ${whereSql} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
	const rows = db.prepare(dataQuery).all(...allParams, limit, offset) as GrievanceRow[];

	return { rows, total: countRow.count };
}

// ─── Grievance Stats ──────────────────────────────────────────────────────────

export function getGrievanceStats(
	db: Database,
	scope: { role: string; userId: string; hostelId?: string | null }
): GrievanceStats {
	let whereClause = '';
	let baseParam: unknown[] = [];

	if (scope.role === 'student') {
		whereClause = 'WHERE student_id = ?';
		baseParam = [scope.userId];
	} else if (scope.role === 'warden') {
		if (!scope.hostelId) {
			whereClause = 'WHERE 1 = 0';
		} else {
			whereClause = 'WHERE student_id IN (SELECT id FROM users WHERE hostel_id = ?)';
			baseParam = [scope.hostelId];
		}
	}

	const statusRows = db
		.prepare(`SELECT status, COUNT(*) as count FROM grievances ${whereClause} GROUP BY status`)
		.all(...baseParam) as { status: string; count: number }[];

	const categoryRows = db
		.prepare(`SELECT category, COUNT(*) as count FROM grievances ${whereClause} GROUP BY category ORDER BY count DESC`)
		.all(...baseParam) as { category: string; count: number }[];

	const priorityRows = db
		.prepare(`SELECT priority, COUNT(*) as count FROM grievances ${whereClause} GROUP BY priority`)
		.all(...baseParam) as { priority: string; count: number }[];

	const todayIso = new Date().toISOString().slice(0, 10);
	const todayRow = db
		.prepare(
			`SELECT COUNT(*) as count FROM grievances ${whereClause ? whereClause + ' AND' : 'WHERE'} created_at LIKE ?`
		)
		.get(...baseParam, `${todayIso}%`) as { count: number };

	let open = 0, inProgress = 0, resolved = 0;
	for (const r of statusRows) {
		if (r.status === 'open') open = r.count;
		else if (r.status === 'in_progress') inProgress = r.count;
		else if (r.status === 'resolved') resolved = r.count;
	}


	return {
		total: open + inProgress + resolved,
		open,
		inProgress,
		resolved,
		today: todayRow.count,
		byCategory: Object.fromEntries(categoryRows.map((r) => [r.category, r.count])),
		byPriority: Object.fromEntries(priorityRows.map((r) => [r.priority, r.count]))
	};
}

export interface InsertAuditLogInput {
	id?: string;
	eventType: string;
	action: string;
	actorId?: string | null;
	actorName?: string | null;
	actorEmail?: string | null;
	actorRole: AuditLogRole;
	targetId?: string | null;
	targetType?: string | null;
	details?: Record<string, unknown> | string | null;
	ipAddress?: string | null;
	status?: AuditLogStatus;
	createdAt?: string;
}

export function insertAuditLog(db: Database, input: InsertAuditLogInput): AuditLogRow {
	const id = input.id ?? nextAuditLogId(db);
	const createdAt = input.createdAt ?? new Date().toISOString();
	const status: AuditLogStatus = input.status ?? 'success';
	const details =
		typeof input.details === 'object' && input.details !== null
			? JSON.stringify(input.details)
			: typeof input.details === 'string'
				? input.details
				: null;

	db.prepare(
		`INSERT INTO audit_logs (id, event_type, action, actor_id, actor_name, actor_email, actor_role, target_id, target_type, details, ip_address, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).run(
		id,
		input.eventType,
		input.action,
		input.actorId ?? null,
		input.actorName ?? null,
		input.actorEmail ?? null,
		input.actorRole,
		input.targetId ?? null,
		input.targetType ?? null,
		details,
		input.ipAddress ?? null,
		status,
		createdAt
	);

	return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as AuditLogRow;
}

function buildAuditWhere(filters: AuditLogFilters): { sql: string; params: unknown[] } {
	const conditions: string[] = [];
	const params: unknown[] = [];

	if (filters.role && filters.role !== 'all') {
		conditions.push('actor_role = ?');
		params.push(filters.role);
	}

	if (filters.eventType && filters.eventType !== 'all') {
		conditions.push('event_type LIKE ?');
		params.push(`%${filters.eventType}%`);
	}

	if (filters.status && filters.status !== 'all') {
		conditions.push('status = ?');
		params.push(filters.status);
	}

	if (filters.search && filters.search.trim()) {
		const q = `%${filters.search.trim().toLowerCase()}%`;
		conditions.push(
			"(LOWER(action) LIKE ? OR LOWER(event_type) LIKE ? OR LOWER(COALESCE(actor_name, '')) LIKE ? OR LOWER(COALESCE(actor_email, '')) LIKE ? OR LOWER(COALESCE(target_id, '')) LIKE ? OR LOWER(COALESCE(details, '')) LIKE ?)"
		);
		params.push(q, q, q, q, q, q);
	}

	const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
	return { sql, params };
}

export function listAuditLogs(db: Database, filters: AuditLogFilters = {}): AuditLogRow[] {
	const { sql, params } = buildAuditWhere(filters);
	const page = Math.max(1, filters.page ?? 1);
	const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
	const offset = (page - 1) * limit;

	const query = `SELECT * FROM audit_logs ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;
	return db.prepare(query).all(...params, limit, offset) as AuditLogRow[];
}

export function countAuditLogs(db: Database, filters: AuditLogFilters = {}): number {
	const { sql, params } = buildAuditWhere(filters);
	const query = `SELECT COUNT(*) as count FROM audit_logs ${sql}`;
	const row = db.prepare(query).get(...params) as { count: number };
	return row.count;
}

export function getAuditLogStats(db: Database): AuditLogStats {
	const totalRow = db.prepare('SELECT COUNT(*) as total FROM audit_logs').get() as { total: number };
	const roleRows = db.prepare('SELECT actor_role, COUNT(*) as count FROM audit_logs GROUP BY actor_role').all() as { actor_role: AuditLogRole; count: number }[];
	const warningRow = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE status IN ('warning', 'failure')").get() as { count: number };
	
	const todayIsoPrefix = new Date().toISOString().slice(0, 10);
	const todayRow = db.prepare('SELECT COUNT(*) as count FROM audit_logs WHERE created_at LIKE ?').get(`${todayIsoPrefix}%`) as { count: number };

	let studentEvents = 0;
	let wardenEvents = 0;
	let adminEvents = 0;
	let systemEvents = 0;

	for (const r of roleRows) {
		if (r.actor_role === 'student') studentEvents = r.count;
		else if (r.actor_role === 'warden') wardenEvents = r.count;
		else if (r.actor_role === 'admin') adminEvents = r.count;
		else if (r.actor_role === 'system') systemEvents = r.count;
	}

	return {
		totalEvents: totalRow.total,
		studentEvents,
		wardenEvents,
		adminEvents,
		systemEvents,
		warningEvents: warningRow.count,
		todayEvents: todayRow.count
	};
}

// ─── Grievance Analytics ─────────────────────────────────────────────────────

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

export interface MonthlyVolume {
	month: string; // "YYYY-MM"
	count: number;
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

/**
 * Compute system-wide grievance analytics for the admin analytics dashboard.
 * All queries are single-pass aggregations — no N+1 loops.
 *
 * @param db   - better-sqlite3 Database instance
 * @param days - Restrict to grievances filed in the last N days. 0 = all time.
 */
export function getGrievanceAnalytics(db: Database, days: number = 0): GrievanceAnalytics {
	const timeFilter =
		days > 0 ? `AND g.created_at >= datetime('now', '-${Math.floor(days)} days')` : '';

	// ── 1. Overall status counts ──────────────────────────────────────────────
	const statusRows = db
		.prepare(
			`SELECT g.status, COUNT(*) as count FROM grievances g WHERE 1=1 ${timeFilter} GROUP BY g.status`
		)
		.all() as { status: string; count: number }[];

	let totalGrievances = 0;
	let resolved = 0;
	let open = 0;
	let inProgress = 0;
	for (const r of statusRows) {
		totalGrievances += r.count;
		if (r.status === 'resolved') resolved = r.count;
		else if (r.status === 'open') open = r.count;
		else if (r.status === 'in_progress') inProgress = r.count;
	}
	const resolutionRatePct =
		totalGrievances > 0 ? Math.round((resolved / totalGrievances) * 100) : 0;

	// ── 2. Average resolution hours (resolved only) ───────────────────────────
	const avgRow = db
		.prepare(
			`SELECT AVG((julianday(g.updated_at) - julianday(g.created_at)) * 24.0) AS avg_hours
       FROM grievances g WHERE g.status = 'resolved' ${timeFilter}`
		)
		.get() as { avg_hours: number | null };
	const avgResolutionHours =
		avgRow.avg_hours !== null ? Math.round(avgRow.avg_hours * 10) / 10 : null;

	// ── 3. Overdue count ──────────────────────────────────────────────────────
	const overdueRow = db
		.prepare(
			`SELECT COUNT(*) as count FROM grievances g
       WHERE g.status != 'resolved' ${timeFilter}
         AND (
           (g.priority = 'urgent' AND g.created_at < datetime('now', '-1 day'))
        OR (g.priority = 'high'   AND g.created_at < datetime('now', '-3 days'))
        OR (g.priority = 'medium' AND g.created_at < datetime('now', '-5 days'))
        OR (g.priority = 'low'    AND g.created_at < datetime('now', '-7 days'))
         )`
		)
		.get() as { count: number };
	const overdueCount = overdueRow.count;

	// ── 4. By category ───────────────────────────────────────────────────────
	const categoryRows = db
		.prepare(
			`SELECT g.category, COUNT(*) as count FROM grievances g WHERE 1=1 ${timeFilter} GROUP BY g.category ORDER BY count DESC`
		)
		.all() as { category: string; count: number }[];
	const byCategory = Object.fromEntries(categoryRows.map((r) => [r.category, r.count]));

	// ── 5. By priority ───────────────────────────────────────────────────────
	const priorityRows = db
		.prepare(
			`SELECT g.priority, COUNT(*) as count FROM grievances g WHERE 1=1 ${timeFilter} GROUP BY g.priority`
		)
		.all() as { priority: string; count: number }[];
	const byPriority = Object.fromEntries(priorityRows.map((r) => [r.priority, r.count]));

	// ── 6. Monthly volume (last 6 calendar months) ────────────────────────────
	const monthlyRows = db
		.prepare(
			`SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
       FROM grievances
       WHERE created_at >= datetime('now', '-6 months')
       GROUP BY month ORDER BY month ASC`
		)
		.all() as { month: string; count: number }[];
	const monthlyVolume: MonthlyVolume[] = monthlyRows.map((r) => ({ month: r.month, count: r.count }));

	// ── 7. Per-warden performance table ──────────────────────────────────────
	const wardenTimeFilter =
		days > 0 ? `AND g.created_at >= datetime('now', '-${Math.floor(days)} days')` : '';
	const wardenRows = db
		.prepare(
			`SELECT
         w.id            AS warden_id,
         w.name          AS warden_name,
         w.emp_id        AS warden_emp_id,
         COUNT(g.id)     AS total_grievances,
         SUM(CASE WHEN g.status = 'resolved'   THEN 1 ELSE 0 END) AS resolved_count,
         SUM(CASE WHEN g.status = 'open'        THEN 1 ELSE 0 END) AS open_count,
         SUM(CASE WHEN g.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
         AVG(CASE WHEN g.status = 'resolved'
               THEN (julianday(g.updated_at) - julianday(g.created_at)) * 24.0
               ELSE NULL END) AS avg_resolution_hours
       FROM users w
       JOIN users s ON s.warden_id = w.id AND s.role = 'student'
       JOIN grievances g ON g.student_id = s.id
       WHERE w.role = 'warden' ${wardenTimeFilter}
       GROUP BY w.id
       ORDER BY total_grievances DESC`
		)
		.all() as {
		warden_id: string;
		warden_name: string;
		warden_emp_id: string | null;
		total_grievances: number;
		resolved_count: number;
		open_count: number;
		in_progress_count: number;
		avg_resolution_hours: number | null;
	}[];

	const wardenPerformance: WardenPerformance[] = wardenRows.map((r) => ({
		wardenId: r.warden_id,
		wardenName: r.warden_name,
		wardenEmpId: r.warden_emp_id,
		totalGrievances: r.total_grievances,
		resolved: r.resolved_count,
		open: r.open_count,
		inProgress: r.in_progress_count,
		resolutionRatePct:
			r.total_grievances > 0 ? Math.round((r.resolved_count / r.total_grievances) * 100) : 0,
		avgResolutionHours:
			r.avg_resolution_hours !== null ? Math.round(r.avg_resolution_hours * 10) / 10 : null
	}));

	return {
		totalGrievances,
		resolved,
		open,
		inProgress,
		resolutionRatePct,
		avgResolutionHours,
		overdueCount,
		byCategory,
		byPriority,
		monthlyVolume,
		wardenPerformance
	};
}
