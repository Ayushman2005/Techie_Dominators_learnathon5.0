import type { Database } from 'better-sqlite3';
import { HttpError } from '../http/errors.ts';
import type {
	AttachmentRow,
	CommentRow,
	GrievanceRow,
	PublicGrievance,
	Role,
	SessionUser,
	UserRow
} from '../types/index.ts';
import { toPublicAttachment, toPublicComment, toPublicGrievance, toPublicUser } from './map.ts';

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function findUserById(db: Database, id: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
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

export function assembleGrievance(db: Database, row: GrievanceRow): PublicGrievance {
	const studentRow = findUserById(db, row.student_id);
	if (!studentRow) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const student = toPublicUser(studentRow);
	const attachments = listAttachmentRows(db, row.id).map(toPublicAttachment);
	const comments = listCommentRows(db, row.id).map((comment) => {
		const authorRow = findUserById(db, comment.author_id);
		if (!authorRow) {
			throw new HttpError(500, 'internal', 'Internal server error.');
		}
		return toPublicComment(comment, toPublicUser(authorRow));
	});
	return toPublicGrievance(row, student, attachments, comments);
}

export function requireGrievance(db: Database, id: string): GrievanceRow {
	const row = findGrievanceRow(db, id);
	if (!row) {
		throw new HttpError(404, 'not_found', 'Grievance was not found.');
	}
	return row;
}

export function listUsers(db: Database, role?: Role): UserRow[] {
	if (role) {
		return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role) as UserRow[];
	}
	return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
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
	user: { id: string; name: string; email: string; password_hash: string; role: Role; room: string | null; created_at: string }
): UserRow {
	db.prepare(
		`INSERT INTO users (id, name, email, password_hash, role, room, created_at)
     VALUES (@id, @name, @email, @password_hash, @role, @room, @created_at)`
	).run(user);
	return findUserById(db, user.id)!;
}

export function updateUser(
	db: Database,
	id: string,
	updates: { name?: string; email?: string; password_hash?: string; role?: Role; room?: string | null }
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

	db.prepare(
		'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, room = ? WHERE id = ?'
	).run(nextName, nextEmail, nextPasswordHash, nextRole, nextRoom, id);

	return findUserById(db, id)!;
}

export function deleteUser(db: Database, id: string): void {
	// First clean up any attachments stored on disk if needed, cascading foreign keys delete db rows
	db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function deleteGrievance(db: Database, id: string): void {
	db.prepare('DELETE FROM grievances WHERE id = ?').run(id);
}

export function assertCanViewGrievance(user: SessionUser, row: GrievanceRow): void {
	switch (user.role) {
		case 'admin':
		case 'warden':
			return;
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

export function nextUserId(db: Database, role: Role): string {
	const prefix = role === 'admin' ? 'adm-' : role === 'warden' ? 'war-' : 'stu-';
	const rows = db.prepare('SELECT id FROM users').all() as { id: string }[];
	let max = 0;
	for (const row of rows) {
		if (!row.id.startsWith(prefix)) continue;
		const n = Number.parseInt(row.id.slice(prefix.length), 10);
		if (!Number.isNaN(n) && n > max) max = n;
	}
	return `${prefix}${max + 1}`;
}

function nextPrefixedId(db: Database, table: 'grievances' | 'comments' | 'attachments', prefix: string): string {
	const rows = db.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
	let max = 0;
	for (const row of rows) {
		if (!row.id.startsWith(prefix)) continue;
		const n = Number.parseInt(row.id.slice(prefix.length), 10);
		if (!Number.isNaN(n) && n > max) max = n;
	}
	return `${prefix}${String(max + 1).padStart(prefix === 'GRV-' ? 4 : 0, '0')}`;
}

export function nextGrievanceId(db: Database): string {
	return nextPrefixedId(db, 'grievances', 'GRV-');
}

export function nextCommentId(db: Database): string {
	const rows = db.prepare('SELECT id FROM comments').all() as { id: string }[];
	let max = 0;
	for (const row of rows) {
		const match = /^cmt-(\d+)$/.exec(row.id);
		if (!match) continue;
		const n = Number.parseInt(match[1], 10);
		if (n > max) max = n;
	}
	return `cmt-${max + 1}`;
}

export function nextAttachmentId(db: Database): string {
	const rows = db.prepare('SELECT id FROM attachments').all() as { id: string }[];
	let max = 0;
	for (const row of rows) {
		const match = /^att-(\d+)$/.exec(row.id);
		if (!match) continue;
		const n = Number.parseInt(match[1], 10);
		if (n > max) max = n;
	}
	return `att-${max + 1}`;
}

export function touchGrievance(db: Database, id: string, updatedAt: string): void {
	db.prepare('UPDATE grievances SET updated_at = ? WHERE id = ?').run(updatedAt, id);
}
