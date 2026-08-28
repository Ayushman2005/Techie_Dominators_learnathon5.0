import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import {
	assembleGrievance,
	assertCanViewGrievance,
	deleteGrievance,
	findUserById,
	listAllGrievanceRows,
	listCommentRows,
	listGrievanceRowsForStudent,
	nextAttachmentId,
	nextCommentId,
	nextGrievanceId,
	requireGrievance,
	touchGrievance
} from '../db/queries.ts';
import type { CommentRow, AttachmentRow, GrievanceStatusDb } from '../types/index.ts';
import { toPublicAttachment, toPublicComment, toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { parseCategory, statusToDb } from '../http/status.ts';
import {
	bufferFromUpload,
	newStoredName,
	originalBasename,
	writeStoredFile
} from '../storage/attachments.ts';
import { securityLog } from '../logger.ts';
import { commentRateLimit, createGrievanceRateLimit } from '../middleware/ratelimit.ts';

// Text field limits to prevent abuse and oversized inputs
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 3;

function nowIso(): string {
	return new Date().toISOString();
}

function readString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

export const grievanceRoutes = new Hono<AppEnv>();

/**
 * GET /api/grievances
 *
 * Returns grievances scoped to the authenticated user's role:
 * - Student: only their own grievances (enforced at DB query level)
 * - Warden / Admin: all grievances
 *
 * The server determines the scope from the validated session — never from
 * a client-supplied parameter.
 */
grievanceRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const rows =
		user.role === 'warden' || user.role === 'admin'
			? listAllGrievanceRows(db)
			: listGrievanceRowsForStudent(db, user.id);
	return c.json({
		data: rows.map((row) => assembleGrievance(db, row))
	});
});

/**
 * POST /api/grievances
 *
 * Create a new grievance. Only students may file grievances.
 * The student_id is taken from the authenticated session — never from the request body.
 * Rate limited to prevent abuse.
 */
grievanceRoutes.post('/', createGrievanceRateLimit, async (c) => {
	const db = c.get('db');
	const uploadsDir = c.get('uploadsDir');
	const user = requireUser(c, db);
	if (user.role !== 'student') {
		throw new HttpError(403, 'unauthorized', 'Only students can file grievances.');
	}

	const contentType = c.req.header('content-type') ?? '';
	let title = '';
	let category = '';
	let description = '';
	let upload: File | undefined;

	if (contentType.includes('multipart/form-data')) {
		const body = await c.req.parseBody();
		title = readString(body.title) ?? '';
		category = readString(body.category) ?? '';
		description = readString(body.description) ?? '';
		if (body.file instanceof File) upload = body.file;
		else if (body.attachment instanceof File) upload = body.attachment;
	} else {
		let json: unknown;
		try {
			json = await c.req.json();
		} catch {
			throw new HttpError(400, 'bad_request', 'Request body must be JSON or multipart form data.');
		}
		if (!json || typeof json !== 'object') {
			throw new HttpError(400, 'bad_request', 'Request body must be JSON or multipart form data.');
		}
		title = readString('title' in json ? json.title : undefined) ?? '';
		category = readString('category' in json ? json.category : undefined) ?? '';
		description = readString('description' in json ? json.description : undefined) ?? '';
	}

	title = title.trim();
	description = description.trim();

	// Input validation with length limits
	if (title.length < 5) {
		throw new HttpError(400, 'bad_request', 'Title must be at least 5 characters.');
	}
	if (title.length > MAX_TITLE_LENGTH) {
		throw new HttpError(400, 'bad_request', `Title must be at most ${MAX_TITLE_LENGTH} characters.`);
	}
	if (description.length < 20) {
		throw new HttpError(400, 'bad_request', 'Description must be at least 20 characters.');
	}
	if (description.length > MAX_DESCRIPTION_LENGTH) {
		throw new HttpError(
			400,
			'bad_request',
			`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`
		);
	}
	const parsedCategory = parseCategory(category);

	// student_id comes from the validated server-side session, never from the client
	const id = nextGrievanceId(db);
	const ts = nowIso();
	db.prepare(
		`INSERT INTO grievances (id, student_id, title, category, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
	).run(id, user.id, title, parsedCategory, description, ts, ts);

	if (upload) {
		const bytes = await bufferFromUpload(upload);
		// Stored filename is always server-generated — never user-controlled
		const stored = newStoredName(upload.type);
		writeStoredFile(uploadsDir, stored, bytes);
		db.prepare(
			`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			nextAttachmentId(db),
			id,
			originalBasename(upload.name),
			stored,
			upload.type,
			bytes.byteLength,
			bytes,
			ts
		);
		securityLog('file_upload_success', {
			userId: user.id,
			resourceId: id,
			resourceType: 'grievance_attachment',
			sizeBytes: bytes.byteLength,
			mimeType: upload.type
		});
	}

	securityLog('grievance_created', { userId: user.id, resourceId: id });
	return c.json({ data: assembleGrievance(db, requireGrievance(db, id)) }, 201);
});

/**
 * GET /api/grievances/:id/comments
 *
 * Returns comments for a grievance.
 * CRITICAL FIX: assertCanViewGrievance enforces that students can only view
 * comments on their own grievances. Without this check, IDOR allowed any
 * authenticated student to read any grievance's comments.
 */
grievanceRoutes.get('/:id/comments', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	// Authorization: students can only view comments on their own grievances
	assertCanViewGrievance(user, row);
	const comments = listCommentRows(db, row.id).map((comment) => {
		const authorRow = findUserById(db, comment.author_id);
		if (!authorRow) {
			throw new HttpError(500, 'internal', 'Internal server error.');
		}
		return toPublicComment(comment, toPublicUser(authorRow));
	});
	return c.json({ data: comments });
});

/**
 * POST /api/grievances/:id/comments
 *
 * Add a comment to a grievance.
 * - Students may only comment on their own grievances
 * - Wardens may comment on any grievance (part of their review workflow)
 * Rate limited per user.
 */
grievanceRoutes.post('/:id/comments', commentRateLimit, async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

	// Authorization: students can only comment on their own grievances
	assertCanViewGrievance(user, row);

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'JSON body is required.');
	}
	const text =
		body && typeof body === 'object' && 'body' in body && typeof body.body === 'string'
			? body.body.trim()
			: '';
	if (!text || text.length < MIN_COMMENT_LENGTH) {
		throw new HttpError(400, 'bad_request', `Comment must be at least ${MIN_COMMENT_LENGTH} characters.`);
	}
	if (text.length > MAX_COMMENT_LENGTH) {
		throw new HttpError(400, 'bad_request', `Comment must be at most ${MAX_COMMENT_LENGTH} characters.`);
	}

	const id = nextCommentId(db);
	const ts = nowIso();
	db.prepare(
		`INSERT INTO comments (id, grievance_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)`
	).run(id, row.id, user.id, text, ts);
	touchGrievance(db, row.id, ts);

	securityLog('comment_created', {
		userId: user.id,
		role: user.role,
		resourceId: row.id,
		resourceType: 'grievance'
	});

	const author = findUserById(db, user.id);
	if (!author) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const commentRow = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRow;
	return c.json({ data: toPublicComment(commentRow, toPublicUser(author)) }, 201);
});

/**
 * POST /api/grievances/:id/attachments
 *
 * Upload an attachment to an existing grievance.
 * Only the student owner of the grievance may attach files.
 */
grievanceRoutes.post('/:id/attachments', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	if (user.role !== 'student' || row.student_id !== user.id) {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			resourceId: row.id,
			reason: 'not_attachment_owner'
		});
		throw new HttpError(403, 'unauthorized', 'Only the student owner can add attachments.');
	}
	if (row.status === 'resolved') {
		throw new HttpError(409, 'conflict', 'Resolved grievances cannot be edited.');
	}

	const body = await c.req.parseBody();
	const upload =
		body.file instanceof File ? body.file : body.attachment instanceof File ? body.attachment : undefined;
	if (!upload) {
		throw new HttpError(400, 'bad_request', 'A file field named file is required.');
	}

	const bytes = await bufferFromUpload(upload);
	// Always generate a random stored filename — never use the user-supplied name as the stored path
	const stored = newStoredName(upload.type);
	const ts = nowIso();
	writeStoredFile(c.get('uploadsDir'), stored, bytes);
	const id = nextAttachmentId(db);
	db.prepare(
		`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(id, row.id, originalBasename(upload.name), stored, upload.type, bytes.byteLength, bytes, ts);
	touchGrievance(db, row.id, ts);

	securityLog('file_upload_success', {
		userId: user.id,
		resourceId: row.id,
		resourceType: 'grievance_attachment',
		sizeBytes: bytes.byteLength,
		mimeType: upload.type
	});

	const saved = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow;
	return c.json({ data: toPublicAttachment(saved) }, 201);
});

/**
 * GET /api/grievances/:id
 *
 * Returns a single grievance with full details.
 * CRITICAL FIX: assertCanViewGrievance enforces that students can only view
 * their own grievances. Previously this check was missing despite the helper
 * function existing in the codebase — a classic "dead code IDOR" bug.
 */
grievanceRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	// CRITICAL: must call this — it throws 403 for students accessing others' grievances
	assertCanViewGrievance(user, row);
	return c.json({ data: assembleGrievance(db, row) });
});

/**
 * PATCH /api/grievances/:id
 *
 * Update a grievance. Role-based authorization:
 * - Students: may edit content (title/description/category) of their OWN open grievances only
 *   CRITICAL FIX: added ownership check (row.student_id !== user.id) — previously missing
 * - Wardens: may only change status (not content)
 */
grievanceRoutes.patch('/:id', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	const title = 'title' in body ? body.title : undefined;
	const description = 'description' in body ? body.description : undefined;
	const category = 'category' in body ? body.category : undefined;
	const status = 'status' in body ? body.status : undefined;
	const wantsContent = title !== undefined || description !== undefined || category !== undefined;
	const wantsStatus = status !== undefined;

	if (!wantsContent && !wantsStatus) {
		throw new HttpError(400, 'bad_request', 'No updatable fields were provided.');
	}

	switch (user.role) {
		case 'student': {
			// CRITICAL FIX: Ownership check — student can only edit their own grievances
			if (row.student_id !== user.id) {
				securityLog('authorization_failure', {
					userId: user.id,
					role: user.role,
					resourceId: row.id,
					reason: 'student_not_owner'
				});
				throw new HttpError(403, 'unauthorized', 'Access denied.');
			}
			if (row.status === 'resolved') {
				throw new HttpError(409, 'conflict', 'Resolved grievances cannot be edited.');
			}
			// Students cannot change status — only wardens can
			if (wantsStatus) {
				throw new HttpError(403, 'unauthorized', 'Students cannot change grievance status.');
			}
			let nextTitle = row.title;
			let nextDescription = row.description;
			let nextCategory = row.category;
			if (title !== undefined) {
				if (typeof title !== 'string' || title.trim().length < 5) {
					throw new HttpError(400, 'bad_request', 'Title must be at least 5 characters.');
				}
				if (title.trim().length > MAX_TITLE_LENGTH) {
					throw new HttpError(400, 'bad_request', `Title must be at most ${MAX_TITLE_LENGTH} characters.`);
				}
				nextTitle = title.trim();
			}
			if (description !== undefined) {
				if (typeof description !== 'string' || description.trim().length < 20) {
					throw new HttpError(400, 'bad_request', 'Description must be at least 20 characters.');
				}
				if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
					throw new HttpError(
						400,
						'bad_request',
						`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`
					);
				}
				nextDescription = description.trim();
			}
			if (category !== undefined) {
				if (typeof category !== 'string') {
					throw new HttpError(400, 'bad_request', 'Invalid grievance category.');
				}
				nextCategory = parseCategory(category);
			}
			const ts = nowIso();
			db.prepare(
				'UPDATE grievances SET title = ?, description = ?, category = ?, updated_at = ? WHERE id = ?'
			).run(nextTitle, nextDescription, nextCategory, ts, row.id);
			break;
		}
		case 'warden': {
			if (wantsContent) {
				throw new HttpError(403, 'unauthorized', 'Wardens cannot edit grievance content.');
			}
			if (typeof status !== 'string') {
				throw new HttpError(400, 'bad_request', 'Invalid grievance status.');
			}
			const nextStatus: GrievanceStatusDb = statusToDb(status);
			const ts = nowIso();
			db.prepare('UPDATE grievances SET status = ?, updated_at = ? WHERE id = ?').run(
				nextStatus,
				ts,
				row.id
			);
			securityLog('grievance_status_changed', {
				userId: user.id,
				role: user.role,
				resourceId: row.id,
				newStatus: nextStatus
			});
			break;
		}
		case 'admin': {
			let nextStatus: GrievanceStatusDb = row.status;
			let adminTitle = row.title;
			let adminDescription = row.description;
			let adminCategory = row.category;

			if (status !== undefined) {
				if (typeof status !== 'string') {
					throw new HttpError(400, 'bad_request', 'Invalid grievance status.');
				}
				nextStatus = statusToDb(status);
			}
			if (wantsContent) {
				if (title !== undefined) {
					if (typeof title !== 'string' || !title.trim()) {
						throw new HttpError(400, 'bad_request', 'Title must not be empty.');
					}
					if (title.trim().length > MAX_TITLE_LENGTH) {
						throw new HttpError(
							400,
							'bad_request',
							`Title must be at most ${MAX_TITLE_LENGTH} characters.`
						);
					}
					adminTitle = title.trim();
				}
				if (description !== undefined) {
					if (typeof description !== 'string' || !description.trim()) {
						throw new HttpError(400, 'bad_request', 'Description must not be empty.');
					}
					if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
						throw new HttpError(
							400,
							'bad_request',
							`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`
						);
					}
					adminDescription = description.trim();
				}
				if (category !== undefined) {
					if (typeof category !== 'string') {
						throw new HttpError(400, 'bad_request', 'Invalid grievance category.');
					}
					adminCategory = parseCategory(category);
				}
			}
			const ts = nowIso();
			db.prepare(
				'UPDATE grievances SET title = ?, description = ?, category = ?, status = ?, updated_at = ? WHERE id = ?'
			).run(adminTitle, adminDescription, adminCategory, nextStatus, ts, row.id);
			if (status !== undefined) {
				securityLog('grievance_status_changed', {
					userId: user.id,
					role: user.role,
					resourceId: row.id,
					newStatus: nextStatus
				});
			}
			break;
		}
		default: {
			const _exhaustive: never = user.role;
			throw new HttpError(500, 'internal', 'Internal server error.');
			void _exhaustive;
		}
	}

	return c.json({ data: assembleGrievance(db, requireGrievance(db, row.id)) });
});

/**
 * DELETE /api/grievances/:id
 *
 * Delete a grievance (Admin only).
 */
grievanceRoutes.delete('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

	if (user.role !== 'admin') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			resourceId: row.id,
			reason: 'delete_grievance_requires_admin'
		});
		throw new HttpError(403, 'unauthorized', 'Only administrators can delete grievances.');
	}

	deleteGrievance(db, row.id, c.get('uploadsDir'));

	securityLog('grievance_deleted', {
		userId: user.id,
		role: user.role,
		resourceId: row.id
	});

	return c.json({ ok: true });
});
