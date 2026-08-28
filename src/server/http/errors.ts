import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '../types/index.ts';
import { logInternalError } from '../logger.ts';

export class HttpError extends Error {
	readonly status: ContentfulStatusCode;
	readonly code: ErrorCode;

	constructor(status: ContentfulStatusCode, code: ErrorCode, message: string) {
		super(message);
		this.name = 'HttpError';
		this.status = status;
		this.code = code;
	}
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: ErrorCode, error: string) {
	return c.json({ error, code }, status);
}

/**
 * Global error handler.
 *
 * HttpError instances (our own application errors) are safe to surface to clients —
 * they contain only intentional, user-facing messages with no internal details.
 *
 * All other errors (unexpected exceptions, database errors, etc.) are:
 * 1. Logged in full server-side for investigation
 * 2. Returned to the client as a generic message ONLY
 *
 * This prevents leaking: stack traces, SQLite error messages, filesystem paths,
 * internal exception details, or any implementation information to clients.
 */
export function handleError(err: unknown, c: Context) {
	if (err instanceof HttpError) {
		return jsonError(c, err.status, err.code, err.message);
	}
	// Log full details server-side — never expose to client
	logInternalError(err, { path: c.req.path, method: c.req.method });
	return jsonError(c, 500, 'internal', 'An unexpected error occurred.');
}
