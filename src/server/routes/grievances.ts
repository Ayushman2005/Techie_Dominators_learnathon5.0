import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireUser } from '../auth/session.ts';
import {
	assembleGrievance,
	assertCanViewGrievance,
	deleteGrievance,
	findResolutionReviewRow,
	findUserById,
	insertResolutionReview,
	listAllGrievanceRows,
	listCommentRows,
	listGrievanceRowsForStudent,
	listGrievanceRowsForWarden,
	nextAttachmentId,
	nextCommentId,
	nextGrievanceId,
	nextResolutionReviewId,
	requireGrievance,
	touchGrievance
} from '../db/queries.ts';
import type { CommentRow, AttachmentRow, GrievanceStatusDb } from '../types/index.ts';
import { toPublicAttachment, toPublicComment, toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { parseCategory, statusToDb, statusToUi } from '../http/status.ts';
import {
	bufferFromUpload,
	newStoredName,
	originalBasename,
	writeStoredFile
} from '../storage/attachments.ts';
import { securityLog } from '../logger.ts';
import { commentRateLimit, createGrievanceRateLimit } from '../middleware/ratelimit.ts';
import { recordAuditLog } from '../audit.ts';

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

grievanceRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	let rows;
	if (user.role === 'admin') {
		rows = listAllGrievanceRows(db);
	} else if (user.role === 'warden') {
		rows = listGrievanceRowsForWarden(db, user.id);
	} else {
		rows = listGrievanceRowsForStudent(db, user.id);
	}
	return c.json({
		data: rows.map((row) => assembleGrievance(db, row))
	});
});

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

	const id = nextGrievanceId(db);
	const ts = nowIso();
	db.prepare(
		`INSERT INTO grievances (id, student_id, title, category, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`
	).run(id, user.id, title, parsedCategory, description, ts, ts);

	recordAuditLog(c, db, {
		eventType: 'grievance.created',
		action: `Filed complaint: ${title}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: id,
		targetType: 'grievance',
		details: {
			title,
			category: parsedCategory,
			studentRoom: user.room ?? 'Unassigned'
		},
		status: 'success'
	});

	if (upload) {
		const bytes = await bufferFromUpload(upload);
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
		recordAuditLog(c, db, {
			eventType: 'attachment.uploaded',
			action: `Uploaded attachment for ${id}`,
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: id,
			targetType: 'grievance_attachment',
			details: {
				filename: upload.name,
				sizeBytes: bytes.byteLength,
				mimeType: upload.type
			},
			status: 'success'
		});
	}

	return c.json({ data: assembleGrievance(db, requireGrievance(db, id)) }, 201);
});

grievanceRoutes.get('/:id/comments', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
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

grievanceRoutes.post('/:id/comments', commentRateLimit, async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

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

	recordAuditLog(c, db, {
		eventType: 'comment.created',
		action: user.role === 'warden' ? `Warden responded to grievance #${row.id}` : `Posted comment on grievance #${row.id}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: row.id,
		targetType: 'grievance',
		details: {
			grievanceTitle: row.title,
			commentSnippet: text.length > 100 ? `${text.slice(0, 100)}...` : text
		},
		status: 'success'
	});

	const author = findUserById(db, user.id);
	if (!author) {
		throw new HttpError(500, 'internal', 'Internal server error.');
	}
	const commentRow = db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as CommentRow;
	return c.json({ data: toPublicComment(commentRow, toPublicUser(author)) }, 201);
});

grievanceRoutes.post('/:id/attachments', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	if (user.role !== 'student' || row.student_id !== user.id) {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized attachment upload attempt',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: row.id,
			targetType: 'grievance',
			details: { reason: 'not_attachment_owner' },
			status: 'warning'
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
	const stored = newStoredName(upload.type);
	const ts = nowIso();
	writeStoredFile(c.get('uploadsDir'), stored, bytes);
	const id = nextAttachmentId(db);
	db.prepare(
		`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(id, row.id, originalBasename(upload.name), stored, upload.type, bytes.byteLength, bytes, ts);
	touchGrievance(db, row.id, ts);

	recordAuditLog(c, db, {
		eventType: 'attachment.uploaded',
		action: `Uploaded attachment for ${row.id}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: row.id,
		targetType: 'grievance_attachment',
		details: {
			filename: upload.name,
			sizeBytes: bytes.byteLength,
			mimeType: upload.type
		},
		status: 'success'
	});

	const saved = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow;
	return c.json({ data: toPublicAttachment(saved) }, 201);
});

grievanceRoutes.post('/:id/review', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

	if (user.role !== 'student' || row.student_id !== user.id) {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized resolution review submission attempt',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: row.id,
			targetType: 'grievance',
			details: { reason: 'not_grievance_owner' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Only the student who filed this grievance can submit a resolution review.');
	}

	if (row.status !== 'resolved') {
		throw new HttpError(409, 'conflict', 'Resolution reviews can only be submitted once the grievance is resolved.');
	}

	const existing = findResolutionReviewRow(db, row.id);
	if (existing) {
		throw new HttpError(409, 'conflict', 'A resolution review has already been submitted for this grievance.');
	}

	const body = await c.req.parseBody();
	const ratingRaw =
		typeof body.rating === 'string'
			? Number.parseInt(body.rating, 10)
			: typeof body.rating === 'number'
				? body.rating
				: Number.NaN;

	if (Number.isNaN(ratingRaw) || ratingRaw < 1 || ratingRaw > 5) {
		throw new HttpError(400, 'bad_request', 'Rating must be an integer between 1 and 5.');
	}

	const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : '';
	if (feedback.length < 5) {
		throw new HttpError(400, 'bad_request', 'Feedback must be at least 5 characters.');
	}
	if (feedback.length > 2000) {
		throw new HttpError(400, 'bad_request', 'Feedback must be at most 2000 characters.');
	}

	const upload =
		body.file instanceof File
			? body.file
			: body.attachment instanceof File
				? body.attachment
				: body.picture instanceof File
					? body.picture
					: undefined;

	if (!upload) {
		throw new HttpError(400, 'bad_request', 'A solution picture is required.');
	}

	const bytes = await bufferFromUpload(upload);
	const stored = newStoredName(upload.type);
	const ts = nowIso();
	writeStoredFile(c.get('uploadsDir'), stored, bytes);

	const attId = nextAttachmentId(db);
	db.prepare(
		`INSERT INTO attachments (id, grievance_id, original_filename, stored_filename, mime_type, size_bytes, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).run(attId, row.id, originalBasename(upload.name), stored, upload.type, bytes.byteLength, bytes, ts);

	const revId = nextResolutionReviewId(db);
	insertResolutionReview(db, {
		id: revId,
		grievanceId: row.id,
		studentId: user.id,
		rating: ratingRaw,
		feedback,
		attachmentId: attId,
		createdAt: ts
	});
	touchGrievance(db, row.id, ts);

	recordAuditLog(c, db, {
		eventType: 'review.submitted',
		action: `Student posted resolution review (${ratingRaw}/5★) with solution picture`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: row.id,
		targetType: 'grievance',
		details: {
			grievanceTitle: row.title,
			rating: ratingRaw,
			feedbackPreview: feedback.length > 100 ? `${feedback.slice(0, 100)}...` : feedback,
			solutionPhoto: upload.name
		},
		status: 'success'
	});

	return c.json({ data: assembleGrievance(db, requireGrievance(db, row.id)) }, 201);
});

grievanceRoutes.get('/:id/review', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	assertCanViewGrievance(user, row);
	const grv = assembleGrievance(db, row);
	return c.json({ data: grv.review ?? null });
});

grievanceRoutes.get('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);
	assertCanViewGrievance(user, row);
	return c.json({ data: assembleGrievance(db, row) });
});

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
			if (row.student_id !== user.id) {
				recordAuditLog(c, db, {
					eventType: 'auth.unauthorized',
					action: 'Unauthorized grievance modification attempt',
					actorId: user.id,
					actorName: user.name,
					actorEmail: user.email,
					actorRole: user.role,
					targetId: row.id,
					targetType: 'grievance',
					details: { reason: 'student_not_owner' },
					status: 'warning'
				});
				throw new HttpError(403, 'unauthorized', 'Access denied.');
			}
			if (row.status === 'resolved') {
				throw new HttpError(409, 'conflict', 'Resolved grievances cannot be edited.');
			}
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

			recordAuditLog(c, db, {
				eventType: 'grievance.updated',
				action: `Updated grievance details: ${nextTitle}`,
				actorId: user.id,
				actorName: user.name,
				actorEmail: user.email,
				actorRole: user.role,
				targetId: row.id,
				targetType: 'grievance',
				details: {
					oldTitle: row.title,
					newTitle: nextTitle,
					oldCategory: row.category,
					newCategory: nextCategory
				},
				status: 'success'
			});
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

			recordAuditLog(c, db, {
				eventType: 'grievance.status_changed',
				action: `Warden updated status to ${statusToUi(nextStatus)}`,
				actorId: user.id,
				actorName: user.name,
				actorEmail: user.email,
				actorRole: user.role,
				targetId: row.id,
				targetType: 'grievance',
				details: {
					grievanceTitle: row.title,
					oldStatus: statusToUi(row.status),
					newStatus: statusToUi(nextStatus)
				},
				status: 'success'
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

			recordAuditLog(c, db, {
				eventType: status !== undefined ? 'grievance.status_changed' : 'grievance.updated',
				action: status !== undefined ? `Admin changed status to ${statusToUi(nextStatus)}` : `Admin modified grievance #${row.id}`,
				actorId: user.id,
				actorName: user.name,
				actorEmail: user.email,
				actorRole: user.role,
				targetId: row.id,
				targetType: 'grievance',
				details: {
					grievanceTitle: adminTitle,
					oldStatus: statusToUi(row.status),
					newStatus: statusToUi(nextStatus)
				},
				status: 'success'
			});
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

grievanceRoutes.delete('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const row = requireGrievance(db, c.req.param('id')!);

	if (user.role !== 'admin') {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized grievance deletion attempt',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: row.id,
			targetType: 'grievance',
			details: { reason: 'delete_grievance_requires_admin' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Only administrators can delete grievances.');
	}

	deleteGrievance(db, row.id, c.get('uploadsDir'));

	recordAuditLog(c, db, {
		eventType: 'grievance.deleted',
		action: `Permanently deleted grievance: ${row.title}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: row.id,
		targetType: 'grievance',
		details: {
			grievanceTitle: row.title,
			studentId: row.student_id
		},
		status: 'warning'
	});

	return c.json({ ok: true });
});
