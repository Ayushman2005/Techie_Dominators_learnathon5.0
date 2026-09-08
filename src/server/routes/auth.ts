import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import {
	clearSessionCookie,
	createSession,
	destroySession,
	hashToken,
	optionalToken,
	requireUser,
	setSessionCookie
} from '../auth/session.ts';
import { verifyPassword, hashPassword } from '../auth/passwords.ts';
import {
	assembleUser,
	findUserByEmail,
	findUserById,
	findUserByRollNo,
	findUserByEmpId,
	createUser,
	nextUserId
} from '../db/queries.ts';
import { HttpError } from '../http/errors.ts';
import { loginRateLimit } from '../middleware/ratelimit.ts';
import { recordAuditLog } from '../audit.ts';
import type { Role } from '../types/index.ts';
import { MIN_PASSWORD_LENGTH } from '../config.ts';

function validateEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/login', loginRateLimit, async (c) => {
	const db = c.get('db');
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	if (!body || typeof body !== 'object') {
		throw new HttpError(400, 'bad_request', 'Request body must be JSON.');
	}
	const email = 'email' in body && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const password = 'password' in body && typeof body.password === 'string' ? body.password : '';
	if (!email || !password) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}

	if (email.length > 254 || password.length > 1024) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}

	const user = findUserByEmail(db, email);
	const passwordValid = user ? verifyPassword(password, user.password_hash) : false;

	if (!user || !passwordValid) {
		recordAuditLog(c, db, {
			eventType: 'auth.login_failed',
			action: 'Failed sign in attempt',
			actorRole: 'system',
			details: { email },
			status: 'warning'
		});
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}

	const token = createSession(db, user.id);
	setSessionCookie(c, token);

	recordAuditLog(c, db, {
		eventType: 'auth.login_success',
		action: `Signed in as ${user.role}`,
		actorId: user.id,
		actorName: user.name,
		actorEmail: user.email,
		actorRole: user.role,
		targetId: user.id,
		targetType: 'user',
		status: 'success'
	});

	return c.json({ user: assembleUser(db, user) });
});

authRoutes.post('/register', async (c) => {
	const db = c.get('db');
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
	const role = ((typeof raw.role === 'string' ? raw.role.toLowerCase() : '') as Role) || 'student';
	const room = typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim() : null;
	const rollNo = (typeof raw.rollNo === 'string' && raw.rollNo.trim()) || (typeof raw.roll_no === 'string' && raw.roll_no.trim()) || null;
	const empId = (typeof raw.empId === 'string' && raw.empId.trim()) || (typeof raw.emp_id === 'string' && raw.emp_id.trim()) || null;

	if (!name || name.length > 100) {
		throw new HttpError(400, 'bad_request', 'Name is required (max 100 characters).');
	}
	if (!email || email.length > 254 || !validateEmail(email)) {
		throw new HttpError(400, 'bad_request', 'A valid institutional email address is required.');
	}
	if (!password || password.length < MIN_PASSWORD_LENGTH || password.length > 1024) {
		throw new HttpError(400, 'bad_request', `Password must be between ${MIN_PASSWORD_LENGTH} and 1024 characters.`);
	}
	if (role !== 'student' && role !== 'warden' && role !== 'admin') {
		throw new HttpError(400, 'bad_request', 'Role must be student, warden, or admin.');
	}

	const existingEmail = findUserByEmail(db, email);
	if (existingEmail) {
		throw new HttpError(409, 'conflict', 'An account with this email already exists.');
	}

	let wardenId: string | null = null;
	let hostelId: string | null = null;

	if (role === 'student') {
		if (!rollNo) {
			throw new HttpError(400, 'bad_request', 'Roll number is required for students.');
		}
		const existingRoll = findUserByRollNo(db, rollNo);
		if (existingRoll) {
			throw new HttpError(409, 'conflict', `A student with roll number '${rollNo}' already exists.`);
		}
		// Link to first active warden/hostel if present
		const warden = db.prepare("SELECT id, hostel_id FROM users WHERE role = 'warden' LIMIT 1").get() as { id: string; hostel_id: string } | undefined;
		if (warden) {
			wardenId = warden.id;
			hostelId = warden.hostel_id;
		} else {
			const hostel = db.prepare('SELECT id FROM hostels LIMIT 1').get() as { id: string } | undefined;
			if (hostel) hostelId = hostel.id;
		}
	} else if (role === 'warden') {
		if (!empId) {
			throw new HttpError(400, 'bad_request', 'Employee ID is required for wardens.');
		}
		const existingEmp = findUserByEmpId(db, empId);
		if (existingEmp) {
			throw new HttpError(409, 'conflict', `A staff member with employee ID '${empId}' already exists.`);
		}
		const hostel = db.prepare('SELECT id FROM hostels LIMIT 1').get() as { id: string } | undefined;
		if (hostel) hostelId = hostel.id;
	} else if (role === 'admin') {
		if (empId) {
			const existingEmp = findUserByEmpId(db, empId);
			if (existingEmp) {
				throw new HttpError(409, 'conflict', `A staff member with employee ID '${empId}' already exists.`);
			}
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
		warden_id: wardenId,
		hostel_id: hostelId,
		created_at
	});

	const token = createSession(db, newUser.id);
	setSessionCookie(c, token);

	recordAuditLog(c, db, {
		eventType: 'user.created',
		action: `User registered new ${role} account: ${name}`,
		actorId: newUser.id,
		actorName: newUser.name,
		actorEmail: newUser.email,
		actorRole: newUser.role,
		targetId: newUser.id,
		targetType: 'user',
		details: {
			name: newUser.name,
			email: newUser.email,
			role: newUser.role,
			room: newUser.room,
			rollNo: newUser.roll_no,
			empId: newUser.emp_id
		},
		status: 'success'
	});

	return c.json({ user: assembleUser(db, newUser) }, 201);
});

authRoutes.post('/logout', (c) => {
	const db = c.get('db');
	const token = optionalToken(c);
	if (token) {
		const tokenHash = hashToken(token);
		const sessionRow = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(tokenHash) as { user_id: string } | undefined;
		const user = sessionRow ? findUserById(db, sessionRow.user_id) : undefined;

		destroySession(db, token);

		if (user) {
			recordAuditLog(c, db, {
				eventType: 'auth.logout',
				action: 'Signed out of system',
				actorId: user.id,
				actorName: user.name,
				actorEmail: user.email,
				actorRole: user.role,
				targetId: user.id,
				targetType: 'user',
				status: 'info'
			});
		} else {
			recordAuditLog(c, db, {
				eventType: 'auth.logout',
				action: 'Signed out of system',
				actorRole: 'system',
				status: 'info'
			});
		}
	}
	clearSessionCookie(c);
	return c.json({ ok: true });
});

authRoutes.get('/me', (c) => {
	const db = c.get('db');
	const sessionUser = requireUser(c, db);
	const user = findUserById(db, sessionUser.id);
	if (!user) {
		throw new HttpError(404, 'not_found', 'User not found.');
	}
	return c.json({ user: assembleUser(db, user) });
});
