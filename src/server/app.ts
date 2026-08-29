import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from './env.ts';
import { handleError, HttpError } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { grievanceRoutes } from './routes/grievances.ts';
import { attachmentRoutes } from './routes/attachments.ts';
import { userRoutes } from './routes/users.ts';
import { auditRoutes } from './routes/audit.ts';
import { noticeRoutes } from './routes/notices.ts';
import { hostelRoutes } from './routes/hostels.ts';
import { cors } from 'hono/cors';
import { csrfProtection } from './middleware/csrf.ts';

/**
 * Maximum allowed raw request body size (10 MB).
 * This prevents memory exhaustion from maliciously large JSON or multipart bodies
 * before any route handler or file-type validation can reject them.
 * Note: this is separate from MAX_ATTACHMENT_BYTES, which validates individual files.
 */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

export type CreateAppOptions = {
	db: Database;
	uploadsDir: string;
};

function getAllowedOrigins(): string[] {
	const env = process.env.HOSTEL_ALLOWED_ORIGINS;
	if (env) {
		return env
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
	}
	return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

export function createApp(options: CreateAppOptions) {
	const app = new Hono<AppEnv>();
	const allowedOrigins = getAllowedOrigins();

	app.use('*', async (c, next) => {
		c.set('db', options.db);
		c.set('uploadsDir', options.uploadsDir);
		await next();
	});

	app.use(
		'/api/*',
		cors({
			origin: (origin) => {
				if (!origin) return undefined;
				return allowedOrigins.includes(origin) ? origin : undefined;
			},
			credentials: true,
			allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Cookie'],
			exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After']
		})
	);

	app.use('/api/*', async (c, next) => {
		await next();
		c.header('X-Content-Type-Options', 'nosniff');
		c.header('X-Frame-Options', 'DENY');
		c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
		c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
		c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	});

	app.onError((err, c) => handleError(err, c));

	app.notFound((c) => c.json({ error: 'Not found.', code: 'not_found' }, 404));

	/**
	 * Global body size guard — runs before any route handler.
	 * Rejects requests that declare more than MAX_BODY_BYTES via Content-Length.
	 * This is a fast path; actual body bytes are still limited by the route handler.
	 * Note: Content-Length can be omitted (chunked transfer), so this is defense-in-depth.
	 */
	app.use('/api/*', async (c, next) => {
		const cl = c.req.header('content-length');
		if (cl !== undefined && Number(cl) > MAX_BODY_BYTES) {
			throw new HttpError(413, 'too_large', 'Request body too large.');
		}
		await next();
	});

	/**
	 * GET /api/health
	 *
	 * Liveness + readiness probe.
	 * - Verifies the database is reachable and responding.
	 * - Returns process uptime and basic system info.
	 * - Used by load balancers, monitoring systems, and deployment pipelines.
	 */
	app.get('/api/health', (c) => {
		const db = c.get('db');
		let dbOk = false;
		let walMode = false;
		try {
			const ping = db.prepare('SELECT 1 AS ok').get() as { ok: number };
			dbOk = ping?.ok === 1;
			const walRow = db.pragma('journal_mode') as { journal_mode: string }[];
			walMode = walRow?.[0]?.journal_mode === 'wal';
		} catch {
			dbOk = false;
		}
		const ok = dbOk;
		const status = ok ? 200 : 503;
		return c.json(
			{
				ok,
				database: dbOk ? 'up' : 'down',
				walMode,
				uptimeSeconds: Math.floor(process.uptime()),
				timestamp: new Date().toISOString()
			},
			status
		);
	});

	// Apply CSRF protection to all API routes
	app.use('/api/*', csrfProtection);

	app.route('/api', authRoutes);
	app.route('/api/grievances', grievanceRoutes);
	app.route('/api/attachments', attachmentRoutes);
	app.route('/api/users', userRoutes);
	app.route('/api/audit-logs', auditRoutes);
	app.route('/api/notices', noticeRoutes);
	app.route('/api/hostels', hostelRoutes);

	app.all('/api/*', () => {
		throw new HttpError(404, 'not_found', 'Not found.');
	});

	return app;
}
