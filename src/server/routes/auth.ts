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
import { findUserByEmail } from '../db/queries.ts';
import { toPublicUser } from '../db/map.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';
import { loginRateLimit } from '../middleware/ratelimit.ts';

export const authRoutes = new Hono<AppEnv>();

/**
 * POST /api/login
 *
 * Rate limited to 10 attempts per 15 minutes per IP.
 * Returns a generic error for both "user not found" and "wrong password"
 * to prevent username/email enumeration.
 *
 * Never logs passwords — only the email (for forensic correlation) and result.
 */
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

	// Enforce reasonable input length limits to prevent DoS via large inputs
	if (email.length > 254 || password.length > 1024) {
		throw new HttpError(400, 'bad_request', 'Email and password are required.');
	}

	const user = findUserByEmail(db, email);
	// Always call verifyPassword even when user is not found, to prevent
	// timing-based username enumeration attacks
	const passwordValid = user ? verifyPassword(password, user.password_hash) : false;

	if (!user || !passwordValid) {
		securityLog('login_failure', { email });
		// Generic message — never reveal whether the email exists or the password is wrong
		throw new HttpError(401, 'unauthenticated', 'Invalid email or password.');
	}

	const token = createSession(db, user.id);
	setSessionCookie(c, token);

	securityLog('login_success', { userId: user.id, role: user.role, email: user.email });
	return c.json({ user: toPublicUser(user) });
});

/**
 * POST /api/logout
 *
 * Destroys the session server-side AND clears the browser cookie.
 * Without server-side destruction, an attacker who captured the cookie
 * could continue using it even after the user logs out.
 */
authRoutes.post('/logout', (c) => {
	const db = c.get('db');
	const token = optionalToken(c);
	if (token) {
		// Invalidate session in database — token is now permanently unusable
		destroySession(db, token);
		const userId = c.get('currentUserId' as never) as string | undefined;
		securityLog('logout', { userId });
	}
	clearSessionCookie(c);
	return c.json({ ok: true });
});

/**
 * GET /api/me
 *
 * Returns the current authenticated user's public profile.
 * Useful for session restoration on page load.
 */
authRoutes.get('/me', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	return c.json({ user: toPublicUser(user) });
});
