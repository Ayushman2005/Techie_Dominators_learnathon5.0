import type { Context } from 'hono';
import type { Database } from 'better-sqlite3';
import { insertAuditLog, type InsertAuditLogInput } from './db/queries.ts';
import { securityLog, type SecurityEventType } from './logger.ts';
import type { AuditLogRow } from './types/index.ts';

export function getClientIp(c: Context): string {
	const forwarded = c.req.header('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0].trim();
		if (first) return first;
	}
	const realIp = c.req.header('x-real-ip');
	if (realIp) return realIp.trim();
	return '127.0.0.1';
}

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
