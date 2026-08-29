import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env.ts';
import { requireUser, requireAdmin } from '../auth/session.ts';
import { csrfProtection } from '../middleware/csrf.ts';
import { HttpError } from '../http/errors.ts';

export const hostelRoutes = new Hono<AppEnv>();

// GET /api/hostels - List all hostels
hostelRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db); // Anyone logged in can view hostels

	const hostels = db.prepare('SELECT * FROM hostels ORDER BY name ASC').all();
	return c.json({ data: hostels });
});

// POST /api/hostels - Create a hostel (Admin only)
hostelRoutes.post('/', csrfProtection, async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);

	const body = await c.req.json().catch(() => ({}));
	const { name } = body;

	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		throw new HttpError(400, 'bad_request', 'Hostel name is required');
	}

	const existing = db.prepare('SELECT id FROM hostels WHERE name = ?').get(name.trim());
	if (existing) {
		throw new HttpError(409, 'conflict', 'A hostel with this name already exists');
	}

	const id = `hst-${randomUUID()}`;
	const now = new Date().toISOString();

	db.prepare(`
		INSERT INTO hostels (id, name, created_at)
		VALUES (?, ?, ?)
	`).run(id, name.trim(), now);

	// Log audit event
	try {
		db.prepare(`
			INSERT INTO audit_logs (id, event_type, action, actor_id, actor_name, actor_email, actor_role, target_id, target_type, status, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			`log-${randomUUID()}`,
			'hostel_created',
			'Created hostel',
			user.id,
			user.name,
			user.email,
			user.role,
			id,
			'hostel',
			'success',
			new Date().toISOString()
		);
	} catch (e) {
		console.error('Failed to write audit log:', e);
	}

	const newHostel = db.prepare('SELECT * FROM hostels WHERE id = ?').get(id);
	return c.json({ data: newHostel }, 201);
});

// DELETE /api/hostels/:id - Delete a hostel (Admin only)
hostelRoutes.delete('/:id', csrfProtection, (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);
	const id = c.req.param('id');

	// Disallow deleting the default hostel if it exists and we rely on it, but generally admins can delete.
	if (id === 'hst-default') {
		// Just to prevent them from completely breaking the system accidentally
		throw new HttpError(403, 'unauthorized', 'Cannot delete the default system hostel. Rename it instead if needed.');
	}

	const existing = db.prepare('SELECT * FROM hostels WHERE id = ?').get(id) as { name: string } | undefined;
	if (!existing) {
		throw new HttpError(404, 'not_found', 'Hostel not found');
	}

	db.prepare('DELETE FROM hostels WHERE id = ?').run(id);

	// Log audit event
	try {
		db.prepare(`
			INSERT INTO audit_logs (id, event_type, action, actor_id, actor_name, actor_email, actor_role, target_id, target_type, details, status, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			`log-${randomUUID()}`,
			'hostel_deleted',
			'Deleted hostel',
			user.id,
			user.name,
			user.email,
			user.role,
			id,
			'hostel',
			JSON.stringify({ name: existing.name }),
			'success',
			new Date().toISOString()
		);
	} catch (e) {
		console.error('Failed to write audit log:', e);
	}

	return c.json({ message: 'Hostel deleted' });
});
