import { Hono } from 'hono';
import type { AppEnv } from '../env.ts';
import { requireAdmin, requireUser } from '../auth/session.ts';
import { countAuditLogs, getAuditLogStats, listAuditLogs } from '../db/queries.ts';
import { toPublicAuditLog } from '../db/map.ts';
import type { AuditLogRole, AuditLogStatus } from '../types/index.ts';

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.get('/stats', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);

	const stats = getAuditLogStats(db);
	return c.json({ data: stats });
});

function sanitizeCsvCell(value: unknown): string {
	if (value === null || value === undefined) return '""';
	let str = typeof value === 'object' ? JSON.stringify(value) : String(value);
	if (/^[=+\-@\t\r]/.test(str)) {
		str = `'${str}`;
	}
	return `"${str.replaceAll('"', '""')}"`;
}

auditRoutes.get('/export', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);

	const format = c.req.query('format') === 'csv' ? 'csv' : 'json';
	const role = c.req.query('role') as AuditLogRole | 'all' | undefined;
	const eventType = c.req.query('eventType');
	const status = c.req.query('status') as AuditLogStatus | 'all' | undefined;
	const search = c.req.query('search');

	const rows = listAuditLogs(db, {
		role: role || undefined,
		eventType: eventType || undefined,
		status: status || undefined,
		search: search || undefined,
		page: 1,
		limit: 5000
	});

	const logs = rows.map(toPublicAuditLog);

	if (format === 'csv') {
		const headers = [
			'ID',
			'Timestamp',
			'Actor Role',
			'Actor Name',
			'Actor Email',
			'Action',
			'Event Type',
			'Target ID',
			'Target Type',
			'Status',
			'IP Address',
			'Details'
		];

		const csvLines = [headers.join(',')];
		for (const log of logs) {
			const row = [
				sanitizeCsvCell(log.id),
				sanitizeCsvCell(log.createdAt),
				sanitizeCsvCell(log.actorRole),
				sanitizeCsvCell(log.actorName || ''),
				sanitizeCsvCell(log.actorEmail || ''),
				sanitizeCsvCell(log.action || ''),
				sanitizeCsvCell(log.eventType),
				sanitizeCsvCell(log.targetId || ''),
				sanitizeCsvCell(log.targetType || ''),
				sanitizeCsvCell(log.status),
				sanitizeCsvCell(log.ipAddress || ''),
				sanitizeCsvCell(log.details ?? '')
			];
			csvLines.push(row.join(','));
		}

		c.header('Content-Type', 'text/csv; charset=utf-8');
		c.header('Content-Disposition', `attachment; filename="hostel-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
		return c.body(csvLines.join('\n'));
	}

	return c.json({ data: logs });
});

auditRoutes.get('/', (c) => {
	const db = c.get('db');
	const user = requireUser(c, db);
	requireAdmin(user);

	const roleParam = c.req.query('role') as AuditLogRole | 'all' | undefined;
	const eventTypeParam = c.req.query('eventType');
	const statusParam = c.req.query('status') as AuditLogStatus | 'all' | undefined;
	const searchParam = c.req.query('search');
	const pageParam = Number.parseInt(c.req.query('page') ?? '1', 10);
	const limitParam = Number.parseInt(c.req.query('limit') ?? '50', 10);

	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
	const limit = Number.isNaN(limitParam) || limitParam < 1 ? 50 : Math.min(limitParam, 200);

	const filters = {
		role: roleParam || undefined,
		eventType: eventTypeParam || undefined,
		status: statusParam || undefined,
		search: searchParam || undefined,
		page,
		limit
	};

	const rows = listAuditLogs(db, filters);
	const total = countAuditLogs(db, filters);
	const totalPages = Math.ceil(total / limit) || 1;

	return c.json({
		data: rows.map(toPublicAuditLog),
		total,
		page,
		limit,
		totalPages
	});
});
