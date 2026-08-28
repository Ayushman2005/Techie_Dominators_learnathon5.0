/**
 * Structured security event logger.
 *
 * Logs important security events with contextual metadata to stdout.
 * In production, these should be captured by a log aggregator (CloudWatch, Datadog, etc.)
 *
 * IMPORTANT: Never log passwords, session tokens, or sensitive personal data.
 * IP addresses are included for abuse investigation purposes only.
 */

export type SecurityEventType =
	| 'login_success'
	| 'login_failure'
	| 'logout'
	| 'auth_failure'
	| 'authorization_failure'
	| 'session_expired'
	| 'rate_limit_exceeded'
	| 'file_upload_success'
	| 'file_upload_rejected'
	| 'grievance_created'
	| 'grievance_status_changed'
	| 'grievance_deleted'
	| 'comment_created'
	| 'user_created'
	| 'user_updated'
	| 'user_deleted'
	| 'suspicious_request';

export interface SecurityLogContext {
	userId?: string;
	role?: string;
	resourceId?: string;
	resourceType?: string;
	ip?: string;
	reason?: string;
	email?: string; // Only for login events — not passwords
	[key: string]: string | number | boolean | undefined;
}

/**
 * Emit a structured security log entry to stdout.
 * Output is JSON for easy parsing by log aggregators.
 * Sensitive fields (passwords, tokens) must NEVER be passed here.
 */
export function securityLog(event: SecurityEventType, context: SecurityLogContext = {}): void {
	const entry = {
		timestamp: new Date().toISOString(),
		event,
		...context
	};
	// Use console.warn for security events so they stand out from info logs
	console.warn('[SECURITY]', JSON.stringify(entry));
}

/**
 * Log an unexpected (non-HttpError) server error for investigation.
 * Captures full error details server-side while the client receives only a generic message.
 */
export function logInternalError(err: unknown, context: SecurityLogContext = {}): void {
	const entry = {
		timestamp: new Date().toISOString(),
		event: 'internal_error',
		error: err instanceof Error ? err.message : String(err),
		stack: err instanceof Error ? err.stack : undefined,
		...context
	};
	console.error('[ERROR]', JSON.stringify(entry));
}
