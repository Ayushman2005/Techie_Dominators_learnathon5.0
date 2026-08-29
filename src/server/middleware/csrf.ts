import type { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { randomBytes } from 'node:crypto';
import { HttpError } from '../http/errors.ts';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Double-Submit Cookie CSRF Protection Middleware
 *
 * 1. GET requests: Generate a token if missing and set it as a non-HttpOnly cookie.
 * 2. POST/PUT/PATCH/DELETE: Read the token from the cookie AND the header.
 * 3. Reject if they don't match, preventing Cross-Site Request Forgery.
 */
export async function csrfProtection(c: Context, next: Next) {
	if (process.env.NODE_ENV === 'test') {
		return next();
	}
	const method = c.req.method.toUpperCase();
	let cookieToken = getCookie(c, CSRF_COOKIE_NAME);

	// Generate a new token if one doesn't exist
	if (!cookieToken) {
		cookieToken = randomBytes(32).toString('hex');
		setCookie(c, CSRF_COOKIE_NAME, cookieToken, {
			path: '/',
			secure: IS_PRODUCTION, // Must be secure in prod
			sameSite: 'Strict', // Defense in depth
			httpOnly: false, // MUST be false so frontend JS can read it to put in the header
			maxAge: 60 * 60 * 24 // 24 hours
		});
	}

	// For state-changing methods, require the token in the header
	if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		const headerToken = c.req.header(CSRF_HEADER_NAME);

		if (!headerToken) {
			throw new HttpError(403, 'unauthorized', 'CSRF token missing in headers.');
		}

		if (headerToken !== cookieToken) {
			throw new HttpError(403, 'unauthorized', 'CSRF token mismatch.');
		}
	}

	await next();
}
