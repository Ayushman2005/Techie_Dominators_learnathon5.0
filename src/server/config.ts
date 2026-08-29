import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(SERVER_DIR, '../..');

export const DEFAULT_DB_PATH =
	process.env.HOSTEL_DB_PATH ?? path.join(REPO_ROOT, 'data', 'hostel.db');

export const DEFAULT_UPLOADS_DIR =
	process.env.HOSTEL_UPLOADS_DIR ?? path.join(REPO_ROOT, 'uploads');

export const API_PORT = Number(process.env.HOSTEL_API_PORT ?? 3001);

export const SESSION_COOKIE = 'hg_session';

<<<<<<< HEAD
// Ultra-secure: Reduced session TTL to 30 minutes
=======
/** Session time-to-live: 30 minutes (1,800 seconds). */
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
export const SESSION_TTL_SECONDS = 30 * 60;

/** Maximum file size per attachment: 5 MB (raised from 2 MB to support PDFs). */
export const MAX_ATTACHMENT_MB = 5;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

/**
 * Minimum password length enforced server-side.
 * NIST SP 800-63B recommends at least 8; 12 is our institutional minimum.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Maximum number of attachments a student may upload per grievance.
 * Prevents storage abuse without blocking legitimate evidence uploads.
 */
export const MAX_ATTACHMENTS_PER_GRIEVANCE = 5;

/**
 * When true, the server trusts the first IP in X-Forwarded-For.
 * Only enable this if the application sits behind a trusted reverse proxy (nginx/caddy)
 * that strips and re-sets X-Forwarded-For. Enabling on a public-facing server with no
 * proxy allows IP spoofing which defeats rate limiting and corrupts audit logs.
 */
export const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

export const ALLOWED_ATTACHMENT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'application/pdf'
]);
