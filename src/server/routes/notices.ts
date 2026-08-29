import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env.ts';
import { requireUser, requireWardenOrAdmin } from '../auth/session.ts';
import { HttpError } from '../http/errors.ts';

export const noticeRoutes = new Hono<AppEnv>();

// GET /api/notices - List notices relevant to the user
noticeRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	let notices: any[] = [];

	if (user.role === 'admin') {
		notices = db.prepare(`
			SELECT n.*, u.name as author_name, u.role as author_role
			FROM notices n
			JOIN users u ON n.author_id = u.id
			ORDER BY n.created_at DESC
		`).all();
	} else if (user.role === 'warden' || user.role === 'student') {
		// Both students and wardens see global notices (hostel_id IS NULL) + notices for their specific hostel
		const userRecord = db.prepare('SELECT hostel_id FROM users WHERE id = ?').get(user.id) as { hostel_id: string | null };
		if (userRecord.hostel_id) {
			notices = db.prepare(`
				SELECT n.*, u.name as author_name, u.role as author_role
				FROM notices n
				JOIN users u ON n.author_id = u.id
				WHERE n.hostel_id IS NULL OR n.hostel_id = ?
				ORDER BY n.created_at DESC
			`).all(userRecord.hostel_id);
		} else {
			notices = db.prepare(`
				SELECT n.*, u.name as author_name, u.role as author_role
				FROM notices n
				JOIN users u ON n.author_id = u.id
				WHERE n.hostel_id IS NULL
				ORDER BY n.created_at DESC
			`).all();
		}
	}
	return c.json({ data: notices });
});

// POST /api/notices - Create a notice (CSRF is already applied globally by app.use('/api/*', csrfProtection))
noticeRoutes.post('/', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireWardenOrAdmin(user);

	const body = await c.req.json().catch(() => ({}));
	const { title, body: noticeBody, hostel_id } = body;

	if (!title || typeof title !== 'string' || title.trim().length === 0) {
		throw new HttpError(400, 'bad_request', 'Title is required');
	}
	if (!noticeBody || typeof noticeBody !== 'string' || noticeBody.trim().length === 0) {
		throw new HttpError(400, 'bad_request', 'Body is required');
	}

	let finalTarget: string | null = null;
	if (user.role === 'warden') {
		const userRecord = db.prepare('SELECT hostel_id FROM users WHERE id = ?').get(user.id) as { hostel_id: string | null };
		if (!userRecord.hostel_id) {
			throw new HttpError(403, 'unauthorized', 'You must be assigned to a hostel to broadcast notices.');
		}
		finalTarget = userRecord.hostel_id;
	} else if (user.role === 'admin') {
		if (hostel_id) {
			const targetExists = db.prepare('SELECT id FROM hostels WHERE id = ?').get(hostel_id);
			if (!targetExists) {
				throw new HttpError(400, 'bad_request', 'Target hostel not found');
			}
			finalTarget = hostel_id;
		}
	}

	const id = `not-${randomUUID()}`;
	const now = new Date().toISOString();

	db.prepare(`
		INSERT INTO notices (id, author_id, title, body, hostel_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`).run(id, user.id, title.trim(), noticeBody.trim(), finalTarget, now);

	const notice = db.prepare(`
		SELECT n.*, u.name as author_name, u.role as author_role 
		FROM notices n JOIN users u ON n.author_id = u.id 
		WHERE n.id = ?
	`).get(id);
	
	return c.json({ data: notice }, 201);
});

// DELETE /api/notices/:id - Delete a notice (CSRF is already applied globally by app.use('/api/*', csrfProtection))
noticeRoutes.delete('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireWardenOrAdmin(user);
	const id = c.req.param('id');

	const notice = db.prepare('SELECT * FROM notices WHERE id = ?').get(id) as { author_id: string } | undefined;
	if (!notice) {
		throw new HttpError(404, 'not_found', 'Notice not found');
	}

	if (user.role !== 'admin' && notice.author_id !== user.id) {
		throw new HttpError(403, 'unauthorized', 'Cannot delete notice created by someone else');
	}

	db.prepare('DELETE FROM notices WHERE id = ?').run(id);
	return c.json({ success: true });
});
