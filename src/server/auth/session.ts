import { randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../config.ts';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';
import type { SessionUser } from '../types/index.ts';

function nowIso(): string {
	return new Date().toISOString();
}

function expiryIso(): string {
	return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

/**
 * Create a new cryptographically random session token and store it in the DB.
 * 32 bytes of entropy → 256-bit session token (base64url encoded).
 */
export function createSession(db: Database, userId: string): string {
	const token = randomBytes(32).toString('base64url');
	db.prepare(
		'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
	).run(token, userId, nowIso(), expiryIso());
	return token;
}

/**
 * Destroy a session by token. Called on logout to invalidate server-side.
 * Without this, clearing the cookie alone would not prevent reuse of a captured token.
 */
export function destroySession(db: Database, token: string): void {
	db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/**
 * Look up the session user from the DB.
 * Validates: token exists + session is not expired.
 * Expired sessions are deleted eagerly to prevent accumulation.
 */
export function readSessionUser(db: Database, token: string): SessionUser | undefined {
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role, u.room, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
		)
		.get(token) as (SessionUser & { expires_at: string }) | undefined;
	if (!row) return undefined;
	// Validate session expiry server-side — never trust client-provided state
	if (new Date(row.expires_at) <= new Date()) {
		// Eagerly delete expired session to prevent accumulation
		db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
		return undefined;
	}
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		room: row.room,
		created_at: row.created_at
	};
}

/**
 * Set the session cookie with security attributes:
 * - HttpOnly: prevents JavaScript (XSS) from reading the session token
 * - SameSite=Strict: prevents CSRF by blocking cross-site cookie transmission
 * - Secure: HTTPS-only in production (set via NODE_ENV)
 * - Path=/: scoped to entire application
 * - MaxAge: controlled server-side TTL
 */
export function setSessionCookie(c: Context, token: string): void {
	const isProduction = process.env.NODE_ENV === 'production';
	setCookie(c, SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'Strict',
		maxAge: SESSION_TTL_SECONDS
	});
}

/**
 * Clear the session cookie from the browser.
 * Must be paired with destroySession() to fully invalidate the session.
 */
export function clearSessionCookie(c: Context): void {
	const isProduction = process.env.NODE_ENV === 'production';
	deleteCookie(c, SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'Strict'
	});
}

/**
 * Require an authenticated session. Throws 401 if:
 * - No session cookie present
 * - Token not found in DB
 * - Session is expired
 * Never trust client-provided identity — always validate server-side.
 */
export function requireUser(c: Context, db: Database): SessionUser {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) {
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	const user = readSessionUser(db, token);
	if (!user) {
		// Clear invalid/expired cookie to prevent the browser re-sending it
		clearSessionCookie(c);
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	return user;
}

/**
 * Retrieve the current session token if present, without requiring it.
 * Used only for logout flows that need the token to destroy the session.
 */
export function optionalToken(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE);
}

/**
 * Require that the authenticated user has the 'admin' role.
 * Throws 403 if non-admin tries to access an admin-only resource.
 */
export function requireAdmin(user: SessionUser): void {
	if (user.role !== 'admin') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: 'admin_required'
		});
		throw new HttpError(403, 'unauthorized', 'Access denied. Administrator privileges required.');
	}
}

/**
 * Require that the authenticated user has either 'warden' or 'admin' role.
 */
export function requireWardenOrAdmin(user: SessionUser): void {
	if (user.role !== 'warden' && user.role !== 'admin') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: 'staff_required'
		});
		throw new HttpError(403, 'unauthorized', 'Access denied.');
	}
}

/**
 * Require that the authenticated user has the 'warden' role.
 * Throws 403 if a student or other role tries to access a warden-only resource.
 */
export function requireWarden(user: SessionUser): void {
	if (user.role !== 'warden' && user.role !== 'admin') {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: 'warden_required'
		});
		throw new HttpError(403, 'unauthorized', 'Access denied.');
	}
}

/**
 * Require that the authenticated user is the specified student (owner).
 * Throws 403 for cross-student IDOR attempts.
 */
export function requireOwner(user: SessionUser, ownerId: string, resourceType: string): void {
	if (user.role !== 'student' || user.id !== ownerId) {
		securityLog('authorization_failure', {
			userId: user.id,
			role: user.role,
			reason: `${resourceType}_not_owner`
		});
		throw new HttpError(403, 'unauthorized', 'Access denied.');
	}
}
