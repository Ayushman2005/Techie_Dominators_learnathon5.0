import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireAdmin, requireUser } from '../auth/session.ts';
import { hashPassword } from '../auth/passwords.ts';
import {
	assembleUser,
	countUsersByRole,
	createUser,
	deleteUser,
	findUserByEmail,
	findUserByEmpId,
	findUserById,
	findUserByRollNo,
	listUsers,
	listWardens,
	nextUserId,
	updateUser
} from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';
import { recordAuditLog } from '../audit.ts';
import type { Role } from '../types/index.ts';

export const userRoutes = new Hono<AppEnv>();

function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * GET /api/users/stats
 *
 * System user stats for the Admin dashboard.
 */
userRoutes.get('/stats', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);
	return c.json({ data: countUsersByRole(db) });
});

/**
 * GET /api/users/wardens
 *
 * Helper to fetch all active wardens for dropdown selection when creating/editing students.
 */
userRoutes.get('/wardens', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	if (user.role === 'student') {
		throw new HttpError(403, 'unauthorized', 'Students cannot access this resource.');
	}
	const wardens = listWardens(db);
	return c.json({ data: wardens.map((w) => assembleUser(db, w)) });
});

/**
 * GET /api/users
 *
 * List users with strict RBAC:
 * - Admin: Can list all users, or filter by role (?role=student|warden|admin)
 * - Warden: Can ONLY list students assigned to that warden
 * - Student: 403 Forbidden
 */
userRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);

	if (user.role === 'student') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: 'student_cannot_list_users'
		});
		throw new HttpError(403, 'unauthorized', 'Students cannot access user management.');
	}

	const roleParam = c.req.query('role') as Role | undefined;

	let users;
	if (user.role === 'warden') {
		// Wardens are strictly restricted to students assigned directly to them
		users = listUsers(db, 'student', user.id);
	} else {
		// Admins can query any role or all
		users = listUsers(db, roleParam);
	}

	return c.json({
		data: users.map((u) => assembleUser(db, u))
	});
});

/**
 * POST /api/users
 *
 * Create a new user account:
 * - Admin: Can create student, warden, or admin accounts.
 * - Warden: Can ONLY create student accounts (automatically assigned to themselves).
 * - Student: 403 Forbidden.
 */
userRoutes.post('/', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);

	if (user.role === 'student') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: 'student_cannot_create_users'
		});
		throw new HttpError(403, 'unauthorized', 'Students cannot create user accounts.');
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	const raw = body as Record<string, unknown>;
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
	const password = typeof raw.password === 'string' ? raw.password : '';
	const role = raw.role as Role;
	const room = typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim() : null;
	const rollNo =
		(typeof raw.rollNo === 'string' && raw.rollNo.trim()) ||
		(typeof raw.studentId === 'string' && raw.studentId.trim()) ||
		(typeof raw.roll_no === 'string' && raw.roll_no.trim()) ||
		(typeof raw.student_id === 'string' && raw.student_id.trim()) ||
		null;
	const empId =
		(typeof raw.empId === 'string' && raw.empId.trim()) ||
		(typeof raw.emp_id === 'string' && raw.emp_id.trim()) ||
		null;
	let wardenId =
		(typeof raw.wardenId === 'string' && raw.wardenId.trim()) ||
		(typeof raw.warden_id === 'string' && raw.warden_id.trim()) ||
		null;

	if (!name || name.length > 100) {
		throw new HttpError(400, 'bad_request', 'Name is required (max 100 characters).');
	}
	if (!email || email.length > 254 || !validateEmail(email)) {
		throw new HttpError(400, 'bad_request', 'A valid email address is required.');
	}
	if (!password || password.length < 6 || password.length > 1024) {
		throw new HttpError(400, 'bad_request', 'Password must be between 6 and 1024 characters.');
	}
	if (role !== 'student' && role !== 'warden' && role !== 'admin') {
		throw new HttpError(400, 'bad_request', 'Role must be student, warden, or admin.');
	}

	// RBAC hierarchy enforcement
	if (user.role === 'warden') {
		if (role !== 'student') {
			securityLog('authorization_failure', {
				userId: user.id,
				role: user.role,
				reason: 'warden_cannot_create_non_student'
			});
			throw new HttpError(403, 'unauthorized', 'Wardens can only create student accounts.');
		}
		// When a warden creates a student, that student is automatically assigned to this warden
		wardenId = user.id;
	}

	// Duplicate email check
	const existingEmail = findUserByEmail(db, email);
	if (existingEmail) {
		throw new HttpError(409, 'conflict', 'An account with this email already exists.');
	}

	// Student specific validations
	if (role === 'student') {
		if (!rollNo) {
			throw new HttpError(400, 'bad_request', 'Student ID / Roll number is required for students.');
		}
		const existingRoll = findUserByRollNo(db, rollNo);
		if (existingRoll) {
			throw new HttpError(409, 'conflict', `A student with roll number '${rollNo}' already exists.`);
		}
		if (!wardenId && user.role === 'admin') {
			throw new HttpError(400, 'bad_request', 'Please select an assigned warden for the student. Each student must be under one warden.');
		}
		if (wardenId) {
			const wardenUser = findUserById(db, wardenId);
			if (!wardenUser || wardenUser.role !== 'warden') {
				throw new HttpError(400, 'bad_request', 'Assigned warden must be a valid warden user account.');
			}
		}
	}

	// Warden specific validations
	if (role === 'warden') {
		if (!empId) {
			throw new HttpError(400, 'bad_request', 'Employee ID is required for wardens.');
		}
		const existingEmp = findUserByEmpId(db, empId);
		if (existingEmp) {
			throw new HttpError(409, 'conflict', `A staff member with employee ID '${empId}' already exists.`);
		}
	}

	if (role === 'admin' && empId) {
		const existingEmp = findUserByEmpId(db, empId);
		if (existingEmp) {
			throw new HttpError(409, 'conflict', `A staff member with employee ID '${empId}' already exists.`);
		}
	}

	const password_hash = hashPassword(password);
	const newId = nextUserId(db, role);
	const created_at = new Date().toISOString();

	const newUser = createUser(db, {
		id: newId,
		name,
		email,
		password_hash,
		role,
		room: role === 'student' ? room : null,
		roll_no: role === 'student' ? rollNo : null,
		emp_id: role === 'warden' || role === 'admin' ? empId : null,
		warden_id: role === 'student' ? wardenId : null,
		created_at
	});

	recordAuditLog(c, db, {
		eventType: 'user.created',
		action: user.role === 'warden' ? `Warden registered student: ${name} (Roll: ${rollNo})` : `Admin created ${role} account: ${name}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: newUser.id,
		targetType: 'user',
		details: {
			name: newUser.name,
			email: newUser.email,
			role: newUser.role,
			room: newUser.room,
			rollNo: newUser.roll_no,
			empId: newUser.emp_id,
			wardenId: newUser.warden_id
		},
		status: 'success'
	});

	return c.json({ data: assembleUser(db, newUser) }, 201);
});

/**
 * PATCH /api/users/:id
 *
 * Update an existing user:
 * - Admin: Can modify any user.
 * - Warden: Can ONLY modify students assigned to that warden.
 * - Student: 403 Forbidden.
 */
userRoutes.patch('/:id', async (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const targetId = c.req.param('id')!;

	if (user.role === 'student') {
		throw new HttpError(403, 'unauthorized', 'Students cannot modify user accounts.');
	}

	const targetUser = findUserById(db, targetId);
	if (!targetUser) {
		throw new HttpError(404, 'not_found', 'User not found.');
	}

	// RBAC hierarchy check
	if (targetUser.role === 'admin' && user.role !== 'admin') {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized attempt to modify admin account',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: targetUser.id,
			targetType: 'user',
			details: { reason: 'non_admin_modify_admin' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Only administrators can modify admin accounts.');
	}

	if (targetUser.role === 'warden' && user.role !== 'admin') {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized attempt to modify warden account',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: targetUser.id,
			targetType: 'user',
			details: { reason: 'warden_modify_warden' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Wardens cannot modify warden accounts.');
	}

	if (user.role === 'warden' && targetUser.role === 'student' && targetUser.warden_id !== user.id) {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Warden attempted to modify a student assigned to another warden',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: targetUser.id,
			targetType: 'user',
			details: { reason: 'warden_mismatch' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'You can only modify students assigned to you.');
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}

	const raw = body as Record<string, unknown>;
	const updates: {
		name?: string;
		email?: string;
		password_hash?: string;
		role?: Role;
		room?: string | null;
		roll_no?: string | null;
		emp_id?: string | null;
		warden_id?: string | null;
	} = {};

	if ('name' in raw && typeof raw.name === 'string') {
		const name = raw.name.trim();
		if (!name || name.length > 100) {
			throw new HttpError(400, 'bad_request', 'Name must not be empty (max 100 characters).');
		}
		updates.name = name;
	}

	if ('email' in raw && typeof raw.email === 'string') {
		const email = raw.email.trim().toLowerCase();
		if (!email || email.length > 254 || !validateEmail(email)) {
			throw new HttpError(400, 'bad_request', 'A valid email address is required.');
		}
		if (email !== targetUser.email) {
			const existing = findUserByEmail(db, email);
			if (existing) {
				throw new HttpError(409, 'conflict', 'An account with this email already exists.');
			}
			updates.email = email;
		}
	}

	if ('password' in raw && typeof raw.password === 'string' && raw.password.length > 0) {
		if (raw.password.length < 6 || raw.password.length > 1024) {
			throw new HttpError(400, 'bad_request', 'Password must be between 6 and 1024 characters.');
		}
		updates.password_hash = hashPassword(raw.password);
	}

	if ('role' in raw && typeof raw.role === 'string') {
		const nextRole = raw.role as Role;
		if (nextRole !== 'student' && nextRole !== 'warden' && nextRole !== 'admin') {
			throw new HttpError(400, 'bad_request', 'Invalid role.');
		}
		if (user.role !== 'admin' && nextRole !== targetUser.role) {
			throw new HttpError(403, 'unauthorized', 'Only administrators can change user roles.');
		}
		updates.role = nextRole;
	}

	if ('room' in raw) {
		updates.room = typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim() : null;
	}

	if ('rollNo' in raw || 'roll_no' in raw || 'studentId' in raw || 'student_id' in raw) {
		const rVal =
			(typeof raw.rollNo === 'string' && raw.rollNo.trim()) ||
			(typeof raw.studentId === 'string' && raw.studentId.trim()) ||
			(typeof raw.roll_no === 'string' && raw.roll_no.trim()) ||
			(typeof raw.student_id === 'string' && raw.student_id.trim()) ||
			null;
		if (rVal && rVal !== targetUser.roll_no) {
			const existing = findUserByRollNo(db, rVal);
			if (existing && existing.id !== targetId) {
				throw new HttpError(409, 'conflict', `A student with roll number '${rVal}' already exists.`);
			}
		}
		updates.roll_no = rVal;
	}

	if ('empId' in raw || 'emp_id' in raw) {
		const eVal = typeof raw.empId === 'string' ? raw.empId.trim() : typeof raw.emp_id === 'string' ? raw.emp_id.trim() : null;
		if (eVal && eVal !== targetUser.emp_id) {
			const existing = findUserByEmpId(db, eVal);
			if (existing && existing.id !== targetId) {
				throw new HttpError(409, 'conflict', `A staff member with employee ID '${eVal}' already exists.`);
			}
		}
		updates.emp_id = eVal;
	}

	if ('wardenId' in raw || 'warden_id' in raw) {
		if (user.role !== 'admin') {
			throw new HttpError(403, 'unauthorized', 'Only administrators can reassign student wardens.');
		}
		const wVal = typeof raw.wardenId === 'string' ? raw.wardenId.trim() : typeof raw.warden_id === 'string' ? raw.warden_id.trim() : null;
		if (wVal) {
			const wUser = findUserById(db, wVal);
			if (!wUser || wUser.role !== 'warden') {
				throw new HttpError(400, 'bad_request', 'Assigned warden must be a valid warden user account.');
			}
		}
		updates.warden_id = wVal;
	}

	const updated = updateUser(db, targetId, updates);

	recordAuditLog(c, db, {
		eventType: 'user.updated',
		action: user.role === 'warden' ? `Warden updated student ${targetUser.name}` : `Admin updated user ${targetUser.name}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: targetId,
		targetType: 'user',
		details: {
			targetName: updated.name,
			targetEmail: updated.email,
			targetRole: updated.role,
			changedFields: Object.keys(updates)
		},
		status: 'success'
	});

	return c.json({ data: assembleUser(db, updated) });
});

/**
 * DELETE /api/users/:id
 *
 * Delete a user:
 * - Admin: Can delete students, wardens, and other admins (except cannot self-delete).
 * - Warden: Can ONLY delete students (cannot delete wardens or admins).
 * - Student: 403 Forbidden.
 */
userRoutes.delete('/:id', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	const targetId = c.req.param('id')!;

	if (user.role === 'student') {
		throw new HttpError(403, 'unauthorized', 'Students cannot delete user accounts.');
	}

	const targetUser = findUserById(db, targetId);
	if (!targetUser) {
		throw new HttpError(404, 'not_found', 'User not found.');
	}

	// Prevent self deletion
	if (targetUser.id === user.id) {
		throw new HttpError(400, 'bad_request', 'You cannot delete your own account while logged in.');
	}

	// RBAC hierarchy check
	if (targetUser.role === 'admin' && user.role !== 'admin') {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized attempt to delete admin account',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: targetUser.id,
			targetType: 'user',
			details: { reason: 'non_admin_delete_admin' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Only administrators can delete admin accounts.');
	}

	if (targetUser.role === 'warden' && user.role !== 'admin') {
		recordAuditLog(c, db, {
			eventType: 'auth.unauthorized',
			action: 'Unauthorized attempt to delete warden account',
			actorId: user.id,
			actorName: user.name,
			actorEmail: user.email,
			actorRole: user.role,
			targetId: targetUser.id,
			targetType: 'user',
			details: { reason: 'warden_delete_warden' },
			status: 'warning'
		});
		throw new HttpError(403, 'unauthorized', 'Wardens cannot delete warden accounts.');
	}

	deleteUser(db, targetId, c.get('uploadsDir'));

	recordAuditLog(c, db, {
		eventType: 'user.deleted',
		action: user.role === 'warden' ? `Warden removed student: ${targetUser.name}` : `Admin deleted user: ${targetUser.name}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: targetId,
		targetType: 'user',
		details: {
			targetName: targetUser.name,
			targetEmail: targetUser.email,
			targetRole: targetUser.role
		},
		status: 'warning'
	});

	return c.json({ ok: true });
});
