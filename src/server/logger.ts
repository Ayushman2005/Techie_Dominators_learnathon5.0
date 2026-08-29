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
	email?: string;
	[key: string]: string | number | boolean | undefined;
}

export function securityLog(event: SecurityEventType, context: SecurityLogContext = {}): void {
	const entry = {
		timestamp: new Date().toISOString(),
		event,
		...context
	};
	console.warn('[SECURITY]', JSON.stringify(entry));
}

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
