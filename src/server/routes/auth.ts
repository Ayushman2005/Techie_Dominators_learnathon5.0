import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import {
	clearSessionCookie,
	createSession,
	destroySession,
	optionalToken,
	requireUser,
	setSessionCookie
} from '../auth/session.ts';
import { verifyPassword } from '../auth/passwords.ts';
import { assembleUser, findUserByEmail, findUserById } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { loginRateLimit } from '../middleware/ratelimit.ts';
import { recordAuditLog } from '../audit.ts';

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

authRoutes.post('/logout', (c) => {
	const db = c.get('db');
	const token = optionalToken(c);
	if (token) {
		const sessionRow = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: string } | undefined;
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
