import { Hono } from 'hono';
import type { Database } from 'better-sqlite3';
import type { AppEnv } from './env.ts';
import { handleError, HttpError } from './http/errors.ts';
import { authRoutes } from './routes/auth.ts';
import { grievanceRoutes } from './routes/grievances.ts';
import { attachmentRoutes } from './routes/attachments.ts';
import { userRoutes } from './routes/users.ts';
import { auditRoutes } from './routes/audit.ts';
import { cors } from 'hono/cors';

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

	app.get('/api/health', (c) => c.json({ ok: true }));
	app.route('/api', authRoutes);
	app.route('/api/grievances', grievanceRoutes);
	app.route('/api/attachments', attachmentRoutes);
	app.route('/api/users', userRoutes);
	app.route('/api/audit-logs', auditRoutes);

	app.all('/api/*', () => {
		throw new HttpError(404, 'not_found', 'Not found.');
	});

	return app;
}
