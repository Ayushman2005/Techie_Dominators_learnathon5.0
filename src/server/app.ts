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

/**
 * Resolve the allowed CORS origins from environment.
 *
 * In production: set HOSTEL_ALLOWED_ORIGINS to a comma-separated list of
 * trusted frontend origins, e.g. "https://hostelgrievance.youruni.edu"
 *
 * In development: defaults to the local Vite dev server.
 *
 * NEVER use wildcard (*) with credentials — this allows any site to make
 * credentialed cross-origin requests on behalf of your authenticated users.
 */
function getAllowedOrigins(): string[] {
	const env = process.env.HOSTEL_ALLOWED_ORIGINS;
	if (env) {
		return env
			.split(',')
			.map((o) => o.trim())
			.filter(Boolean);
	}
	// Development default — only localhost is trusted
	return ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

export function createApp(options: CreateAppOptions) {
	const app = new Hono<AppEnv>();
	const allowedOrigins = getAllowedOrigins();

	// Inject per-request dependencies
	app.use('*', async (c, next) => {
		c.set('db', options.db);
		c.set('uploadsDir', options.uploadsDir);
		await next();
	});

	/**
	 * CORS: Restrict to explicitly configured trusted origins.
	 * credentials: true is safe here because origins are explicitly allowlisted.
	 *
	 * The origin callback returns the request origin only if it appears in our
	 * allowlist — otherwise returns undefined which causes CORS to be denied.
	 */
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

	/**
	 * Security headers applied to all API responses.
	 *
	 * - X-Content-Type-Options: Prevents MIME-type sniffing; browsers must use
	 *   the declared content-type. Critical for uploaded file serving.
	 *
	 * - X-Frame-Options: Legacy framing protection (for older browsers).
	 *   CSP frame-ancestors is the modern equivalent.
	 *
	 * - Referrer-Policy: Prevents leaking the full URL (including grievance IDs)
	 *   in the Referer header to third-party origins.
	 *
	 * - Content-Security-Policy: For API responses, disallow all resource loading.
	 *   The frontend SvelteKit app sets its own CSP separately.
	 *
	 * - Permissions-Policy: Disable features not needed by a grievance API.
	 *
	 * Note: Strict-Transport-Security (HSTS) should be set by the reverse proxy
	 * (nginx/caddy) that terminates TLS, not by the application server.
	 */
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
