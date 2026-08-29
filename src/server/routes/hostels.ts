import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../env.ts';
import { requireUser, requireAdmin } from '../auth/session.ts';
import { csrfProtection } from '../middleware/csrf.ts';
import { HttpError } from '../http/errors.ts';
import { recordAuditLog } from '../audit.ts';

export const hostelRoutes = new Hono<AppEnv>();

// GET /api/hostels - List all hostels
hostelRoutes.get('/', (c) => {
	const db = c.get('db');
	requireUser(c, db); // Anyone logged in can view hostels

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

	recordAuditLog(c, db, {
		eventType: 'user.created',
		action: `Created hostel: ${name.trim()}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: id,
		targetType: 'hostel',
		details: { name: name.trim() },
		status: 'success'
	});

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
		throw new HttpError(403, 'unauthorized', 'Cannot delete the default system hostel. Rename it instead if needed.');
	}

	const existing = db.prepare('SELECT * FROM hostels WHERE id = ?').get(id) as { name: string } | undefined;
	if (!existing) {
		throw new HttpError(404, 'not_found', 'Hostel not found');
	}

	db.prepare('DELETE FROM hostels WHERE id = ?').run(id);

	recordAuditLog(c, db, {
		eventType: 'user.deleted',
		action: `Deleted hostel: ${existing.name}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: id,
		targetType: 'hostel',
		details: { name: existing.name },
		status: 'success'
	});

	return c.json({ message: 'Hostel deleted' });
});
