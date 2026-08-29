import { createHash, randomBytes } from 'node:crypto';
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

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: Database, userId: string): string {
	const rawToken = randomBytes(32).toString('base64url');
	const tokenHash = hashToken(rawToken);
	db.prepare(
		'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
	).run(tokenHash, userId, nowIso(), expiryIso());
	return rawToken;
}

export function destroySession(db: Database, rawToken: string): void {
	const tokenHash = hashToken(rawToken);
	db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenHash);
}

export function readSessionUser(db: Database, rawToken: string): SessionUser | undefined {
	const tokenHash = hashToken(rawToken);
	const row = db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role, u.room, u.hostel_id, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
		)
		.get(tokenHash) as (SessionUser & { expires_at: string }) | undefined;
	if (!row) return undefined;
	if (new Date(row.expires_at) <= new Date()) {
		db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenHash);
		return undefined;
	}
	// Sliding window renewal: if session expires within 10 minutes, extend it.
	// This ensures active users are never unexpectedly logged out while idle
	// users still get cleaned up after the full TTL.
	const msUntilExpiry = new Date(row.expires_at).getTime() - Date.now();
	const renewThresholdMs = 10 * 60 * 1000; // 10 minutes
	if (msUntilExpiry < renewThresholdMs) {
		db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(expiryIso(), tokenHash);
	}
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		room: row.room,
		hostel_id: row.hostel_id,
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

export function clearSessionCookie(c: Context): void {
	const isProduction = process.env.NODE_ENV === 'production';
	deleteCookie(c, SESSION_COOKIE, {
		path: '/',
		httpOnly: true,
		secure: isProduction,
		sameSite: 'Strict'
	});
}

export function requireUser(c: Context, db: Database): SessionUser {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) {
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	const user = readSessionUser(db, token);
	if (!user) {
		clearSessionCookie(c);
		throw new HttpError(401, 'unauthenticated', 'Authentication required.');
	}
	return user;
}

export function optionalToken(c: Context): string | undefined {
	return getCookie(c, SESSION_COOKIE);
}

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
