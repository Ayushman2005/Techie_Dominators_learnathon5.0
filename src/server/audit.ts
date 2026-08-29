import type { Context } from 'hono';
import type { Database } from 'better-sqlite3';
import { insertAuditLog, type InsertAuditLogInput } from './db/queries.ts';
import { securityLog, type SecurityEventType } from './logger.ts';
import type { AuditLogRow } from './types/index.ts';
<<<<<<< HEAD
import { TRUST_PROXY } from './config.ts';

export function getClientIp(c: Context): string {
	if (TRUST_PROXY) {
		const forwarded = c.req.header('x-forwarded-for');
		if (forwarded) {
			const first = forwarded.split(',')[0].trim();
			if (first) return first;
		}
		const realIp = c.req.header('x-real-ip');
		if (realIp) return realIp.trim();
	}
	// Without a trusted proxy, there is no reliable IP available in Hono Node adapters.
	// We return a fallback rather than trusting a spoofable header.
	return '127.0.0.1';
}

/**
 * Record an audit log event in the database and emit structured console log.
 */
=======
import { getClientIp } from './middleware/ratelimit.ts';
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
export function recordAuditLog(
	c: Context,
	db: Database,
	input: Omit<InsertAuditLogInput, 'ipAddress'> & { ipAddress?: string }
): AuditLogRow {
	const ipAddress = input.ipAddress ?? getClientIp(c);
	const log = insertAuditLog(db, {
		...input,
		ipAddress
	});

	const securityEvents: Record<string, SecurityEventType> = {
		'auth.login_success': 'login_success',
		'auth.login_failed': 'login_failure',
		'auth.logout': 'logout',
		'auth.unauthorized': 'authorization_failure',
		'grievance.created': 'grievance_created',
		'grievance.status_changed': 'grievance_status_changed',
		'grievance.priority_changed': 'grievance_status_changed', // Maps to the same security event type for simplicity
		'grievance.deleted': 'grievance_deleted',
		'comment.created': 'comment_created',
		'user.created': 'user_created',
		'user.updated': 'user_updated',
		'user.deleted': 'user_deleted',
		'attachment.uploaded': 'file_upload_success'
	};

	const secEvent = securityEvents[input.eventType];
	if (secEvent) {
		securityLog(secEvent, {
			userId: input.actorId ?? undefined,
			role: input.actorRole,
			resourceId: input.targetId ?? undefined,
			resourceType: input.targetType ?? undefined,
			ip: ipAddress,
			...(typeof input.details === 'object' && input.details !== null ? (input.details as Record<string, unknown>) : {})
		});
	}

	return log;
}
