/**
 * HostelGrievance — Security Test Suite
 *
 * Tests cover:
 * - Authentication (login, logout, session handling)
 * - Authorization / IDOR (access control between users and roles)
 * - File upload security (type, size, magic bytes, path traversal filenames)
 * - Input validation (length limits, type checks)
 * - Error handling (no internal info leakage)
 * - Security headers
 * - CORS enforcement
 * - Rate limiting (login)
 * - Functional regression (student and warden workflows still work)
 *
 * These tests call the live Hono app in-process — no network needed.
 * Each test uses an isolated in-memory database and temp upload directory.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { openDatabase } from './db/connection.ts';
import { seedDatabase } from './db/seed.ts';
import { resetRateLimitStore } from './middleware/ratelimit.ts';
import type { Database } from 'better-sqlite3';

// ────────────────────────────────────────────────────────────────────────────
// Minimal valid image buffers for file upload tests
// ────────────────────────────────────────────────────────────────────────────

/** 1×1 pixel PNG — valid PNG magic bytes */
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

/** Minimal JPEG — valid JPEG magic bytes (FF D8 FF) */
const JPEG = Buffer.from(
	'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAG/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPwB//9k=',
	'base64'
);

/** Not an image — a plain text file with PNG extension */
const NOT_AN_IMAGE = Buffer.from('Hello, I am not an image. <script>alert(1)</script>');

/** Bytes that start with wrong magic (not a real PNG despite claiming to be) */
const FAKE_PNG = Buffer.from('This is not a PNG file at all');

// ────────────────────────────────────────────────────────────────────────────
// Test harness helpers
// ────────────────────────────────────────────────────────────────────────────

function cookieHeader(res: Response): string {
	const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
	const list = anyHeaders.getSetCookie?.() ?? [];
	if (list.length > 0) {
		return list.map((v) => v.split(';')[0]).join('; ');
	}
	const raw = res.headers.get('set-cookie');
	return raw ? raw.split(';')[0] : '';
}

function cookieAttributes(res: Response): string {
	const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
	const list = anyHeaders.getSetCookie?.() ?? [];
	return list.length > 0 ? list[0] : (res.headers.get('set-cookie') ?? '');
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
	const res = await app.request('/api/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const json = await res.json();
	return { res, json, cookie: cookieHeader(res), rawCookieHeader: cookieAttributes(res) };
}

// ────────────────────────────────────────────────────────────────────────────
// Test fixture
// ────────────────────────────────────────────────────────────────────────────

describe('HostelGrievance Security Tests', () => {
	let dir: string;
	let app: ReturnType<typeof createApp>;
	let db: Database;

	beforeEach(() => {
		// Reset rate limit store so tests are isolated — prevents rate limit state
		// from previous tests causing subsequent login() calls to get 429 → 401.
		resetRateLimitStore();
		dir = mkdtempSync(join(tmpdir(), 'hg-sec-'));
		db = openDatabase(join(dir, 'hostel.db'));
		const uploadDir = join(dir, 'uploads');
		seedDatabase(db, uploadDir);
		app = createApp({ db, uploadsDir: uploadDir });
	});

	afterEach(() => {
		// Close DB before removing temp dir (prevents Windows EPERM errors)
		try {
			db.close();
		} catch {
			/* already closed */
		}
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			/* Windows may still hold handles — ignore in CI */
		}
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 1: Authentication
	// ══════════════════════════════════════════════════════════════════════════

	describe('Authentication', () => {
		it('login works for student and warden accounts', async () => {
			const student = await login(app, 'student@example.test', 'student123');
			expect(student.res.status).toBe(200);
			expect(student.json.user.email).toBe('student@example.test');
			expect(student.json.user.role).toBe('student');
			// Sensitive fields must not be returned
			expect(student.json.user.password).toBeUndefined();
			expect(student.json.user.password_hash).toBeUndefined();
			expect(student.cookie).toContain('hg_session=');

			const warden = await login(app, 'warden@example.test', 'warden123');
			expect(warden.res.status).toBe(200);
			expect(warden.json.user.role).toBe('warden');
		});

		it('session cookie has HttpOnly and SameSite attributes', async () => {
			const { rawCookieHeader } = await login(app, 'student@example.test', 'student123');
			expect(rawCookieHeader.toLowerCase()).toContain('httponly');
			expect(rawCookieHeader.toLowerCase()).toContain('samesite=strict');
		});

		it('rejects invalid credentials with a generic message', async () => {
			const badPassword = await login(app, 'student@example.test', 'wrongpassword');
			expect(badPassword.res.status).toBe(401);
			expect(badPassword.json.code).toBe('unauthenticated');
			expect(badPassword.json.error).toBe('Invalid email or password.');

			const unknownEmail = await login(app, 'nobody@example.test', 'anything');
			expect(unknownEmail.res.status).toBe(401);
			// Both errors must return identical messages to prevent enumeration
			expect(unknownEmail.json.error).toBe(badPassword.json.error);
		});

		it('rejects unauthenticated access to protected endpoints', async () => {
			const res = await app.request('/api/grievances');
			expect(res.status).toBe(401);

			const res2 = await app.request('/api/grievances/GRV-0001');
			expect(res2.status).toBe(401);

			const res3 = await app.request('/api/me');
			expect(res3.status).toBe(401);

			const res4 = await app.request('/api/attachments/att-1');
			expect(res4.status).toBe(401);
		});

		it('logout destroys server-side session so token cannot be reused', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');

			// Session works before logout
			const before = await app.request('/api/me', { headers: { Cookie: cookie } });
			expect(before.status).toBe(200);

			// Logout
			await app.request('/api/logout', { method: 'POST', headers: { Cookie: cookie } });

			// Session is now invalid — same cookie must be rejected
			const after = await app.request('/api/me', { headers: { Cookie: cookie } });
			expect(after.status).toBe(401);
		});

		it('expired session is rejected', async () => {
			const { cookie, json } = await login(app, 'student@example.test', 'student123');
			// Manually expire the session in the DB
			const userId = json.user.id as string;
			db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').run(
				new Date(Date.now() - 1000).toISOString(), // 1 second in the past
				userId
			);
			const res = await app.request('/api/me', { headers: { Cookie: cookie } });
			expect(res.status).toBe(401);
		});

		it('rejects requests with an invalid/forged session cookie', async () => {
			const res = await app.request('/api/me', {
				headers: { Cookie: 'hg_session=totally-fake-token-abcdefg' }
			});
			expect(res.status).toBe(401);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 2: Authorization / IDOR (most critical)
	// ══════════════════════════════════════════════════════════════════════════

	describe('Authorization — IDOR Prevention', () => {
		it('student cannot read another student\'s grievance (IDOR fix)', async () => {
			// GRV-0003 belongs to stu-2 (priya), not stu-1
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
			expect(res.status).toBe(403);
			const json = await res.json();
			expect(json.code).toBe('unauthorized');
		});

		it('student\'s grievance list contains only their own grievances', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			const listJson = await list.json();
			expect(listJson.data.every((g: { studentId: string }) => g.studentId === 'stu-1')).toBe(true);
			expect(listJson.data.some((g: { id: string }) => g.id === 'GRV-0003')).toBe(false);
		});

		it('student cannot read comments on another student\'s grievance', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0003/comments', {
				headers: { Cookie: cookie }
			});
			expect(res.status).toBe(403);
		});

		it('student cannot post a comment on another student\'s grievance', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0003/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ body: 'This should not be allowed at all.' })
			});
			expect(res.status).toBe(403);
		});

		it('student cannot PATCH (edit) another student\'s grievance (IDOR fix)', async () => {
			// stu-1 tries to edit GRV-0003 which belongs to stu-2
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0003', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ title: 'Hijacked grievance title' })
			});
			expect(res.status).toBe(403);
		});

		it('student cannot change status of any grievance', async () => {
			// Students should not be able to resolve their own grievances
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0001', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ status: 'Resolved' })
			});
			expect(res.status).toBe(403);
		});

		it('student cannot download another student\'s attachment (IDOR fix)', async () => {
			// att-3 belongs to GRV-0003 (stu-2) — stu-1 must not access it
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/attachments/att-3', { headers: { Cookie: cookie } });
			expect(res.status).toBe(403);
		});

		it('student can download their own attachment', async () => {
			// att-1 belongs to GRV-0001 (stu-1)
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/attachments/att-1', { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
		});

		it('warden can access any grievance and attachment', async () => {
			const { cookie } = await login(app, 'warden@example.test', 'warden123');

			const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(list.status).toBe(200);
			const listJson = await list.json();
			expect(listJson.data.length).toBeGreaterThanOrEqual(5);

			const g = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
			expect(g.status).toBe(200);

			const att = await app.request('/api/attachments/att-3', { headers: { Cookie: cookie } });
			expect(att.status).toBe(200);
		});

		it('warden can update status but cannot edit content', async () => {
			const { cookie } = await login(app, 'warden@example.test', 'warden123');

			// Status update allowed
			const updated = await app.request('/api/grievances/GRV-0008', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ status: 'In Progress' })
			});
			expect(updated.status).toBe(200);
			const updatedJson = await updated.json();
			expect(updatedJson.data.status).toBe('In Progress');

			// Content edit forbidden
			const contentEdit = await app.request('/api/grievances/GRV-0001', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ title: 'Warden trying to edit content' })
			});
			expect(contentEdit.status).toBe(403);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 3: File Upload Security
	// ══════════════════════════════════════════════════════════════════════════

	describe('File Upload Security', () => {
		it('accepts a valid PNG image', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			form.append('file', new File([PNG], 'photo.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(201);
		});

		it('accepts a valid JPEG image', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			form.append('file', new File([JPEG], 'photo.jpg', { type: 'image/jpeg' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(201);
		});

		it('rejects disallowed file type (text/plain)', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			form.append('file', new File(['notes'], 'notes.txt', { type: 'text/plain' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.code).toBe('bad_request');
		});

		it('rejects oversized file', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const huge = new Uint8Array(2 * 1024 * 1024 + 1);
			const form = new FormData();
			form.append('file', new File([huge], 'big.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(400);
		});

		it('rejects a file with wrong magic bytes (MIME spoofing attempt)', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			// File claims to be PNG but has wrong magic bytes
			form.append('file', new File([FAKE_PNG], 'malicious.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toContain('does not match');
		});

		it('rejects non-image content with image MIME type', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			// Script content but image/png MIME — magic bytes will not match
			form.append('file', new File([NOT_AN_IMAGE], 'shell.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(400);
		});

		it('handles a path-traversal-style filename safely (stored name is random)', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			// Malicious filename — should be stored with a random name, not this path
			form.append('file', new File([PNG], '../../etc/passwd.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			// Should succeed (the dangerous filename is sanitized and not used as storage path)
			expect(res.status).toBe(201);
			const json = await res.json();
			// The original filename is stored as display metadata (sanitized to basename)
			expect(json.data.filename).not.toContain('..');
			expect(json.data.filename).not.toContain('/');
		});

		it('attachment download sets Content-Disposition: attachment', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/attachments/att-1', { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
			const disposition = res.headers.get('content-disposition') ?? '';
			expect(disposition).toContain('attachment');
		});

		it('student cannot attach to a resolved grievance', async () => {
			// GRV-0007 is resolved and owned by stu-3 (rohan)
			const { cookie } = await login(app, 'rohan@example.test', 'student123');
			const form = new FormData();
			form.append('file', new File([PNG], 'photo.png', { type: 'image/png' }));
			const res = await app.request('/api/grievances/GRV-0007/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(409);
		});

		it('stores uploaded picture in both the database and the uploads folder on grievance creation', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			form.append('title', 'Ceiling paint peeling in room');
			form.append('category', 'Room');
			form.append('description', 'Ceiling paint is peeling off heavily after monsoon rain.');
			form.append('file', new File([PNG], 'paint-peel.png', { type: 'image/png' }));

			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			const grievanceId = json.data.id;
			const attId = json.data.attachments[0].id;

			// Verify in SQLite hostel.db
			const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId) as {
				id: string;
				stored_filename: string;
				data: Buffer;
			};
			expect(row).toBeDefined();
			expect(row.data).toBeDefined();
			expect(Buffer.from(row.data).equals(PNG)).toBe(true);

			// Verify in uploads folder on disk
			const uploadPath = join(dir, 'uploads', row.stored_filename);
			expect(existsSync(uploadPath)).toBe(true);
			const diskBytes = readFileSync(uploadPath);
			expect(diskBytes.equals(PNG)).toBe(true);
		});

		it('stores uploaded picture in both the database and the uploads folder on attachment upload', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const form = new FormData();
			form.append('file', new File([JPEG], 'tap-detail.jpg', { type: 'image/jpeg' }));

			const res = await app.request('/api/grievances/GRV-0001/attachments', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			const attId = json.data.id;

			// Verify in SQLite hostel.db
			const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId) as {
				id: string;
				stored_filename: string;
				data: Buffer;
			};
			expect(row).toBeDefined();
			expect(row.data).toBeDefined();
			expect(Buffer.from(row.data).equals(JPEG)).toBe(true);

			// Verify in uploads folder on disk
			const uploadPath = join(dir, 'uploads', row.stored_filename);
			expect(existsSync(uploadPath)).toBe(true);
			const diskBytes = readFileSync(uploadPath);
			expect(diskBytes.equals(JPEG)).toBe(true);
		});

		it('serves attachment from database fallback if disk file is removed', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			// att-1 is seeded
			const row = db.prepare('SELECT stored_filename FROM attachments WHERE id = ?').get('att-1') as {
				stored_filename: string;
			};
			const diskFile = join(dir, 'uploads', row.stored_filename);
			expect(existsSync(diskFile)).toBe(true);

			// Delete file from disk to simulate missing disk storage
			unlinkSync(diskFile);
			expect(existsSync(diskFile)).toBe(false);

			// Request attachment download — should serve from database BLOB
			const res = await app.request('/api/attachments/att-1', { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
			const bytes = Buffer.from(await res.arrayBuffer());
			expect(bytes.equals(JPEG)).toBe(true);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 4: Input Validation
	// ══════════════════════════════════════════════════════════════════════════

	describe('Input Validation', () => {
		it('rejects grievance with title too short', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ title: 'Hi', category: 'Room', description: 'A'.repeat(20) })
			});
			expect(res.status).toBe(400);
		});

		it('rejects grievance with title too long', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					title: 'A'.repeat(201),
					category: 'Room',
					description: 'B'.repeat(20)
				})
			});
			expect(res.status).toBe(400);
		});

		it('rejects grievance with description too short', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ title: 'Valid title here', category: 'Room', description: 'Short' })
			});
			expect(res.status).toBe(400);
		});

		it('rejects grievance with description too long', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					title: 'Valid title here',
					category: 'Room',
					description: 'D'.repeat(5001)
				})
			});
			expect(res.status).toBe(400);
		});

		it('rejects invalid grievance category', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					title: 'Valid title here',
					category: 'Hacking',
					description: 'D'.repeat(25)
				})
			});
			expect(res.status).toBe(400);
		});

		it('rejects comment that is too short', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0001/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ body: 'Hi' })
			});
			expect(res.status).toBe(400);
		});

		it('rejects comment that is too long', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances/GRV-0001/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ body: 'X'.repeat(2001) })
			});
			expect(res.status).toBe(400);
		});

		it('rejects malformed JSON body', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: 'not valid { json'
			});
			expect(res.status).toBe(400);
		});

		it('rejects login with oversized password (before rate limit)', async () => {
			// Note: This test must run before rate limit tests that exhaust the IP quota.
			// resetRateLimitStore() in beforeEach ensures isolation.
			const res = await app.request('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'student@example.test', password: 'A'.repeat(1025) })
			});
			expect(res.status).toBe(400);
		});

		it('returns 404 for unknown grievance IDs without leaking internals', async () => {
			const { cookie } = await login(app, 'warden@example.test', 'warden123');
			const res = await app.request('/api/grievances/GRV-9999', { headers: { Cookie: cookie } });
			expect(res.status).toBe(404);
			const json = await res.json();
			expect(json.code).toBe('not_found');
			// Must not leak internal details
			expect(JSON.stringify(json)).not.toMatch(/sqlite|stack|ENOENT|Error:|at Object/i);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 5: Error Handling — no internal info leakage
	// ══════════════════════════════════════════════════════════════════════════

	describe('Error Handling', () => {
		it('unexpected errors return generic message, not internal details', async () => {
			// Create a grievance to work with
			const { cookie } = await login(app, 'student@example.test', 'student123');
			// Force a 404 — we test that DB error messages don't leak
			const res = await app.request('/api/grievances/TOTALLY-INVALID-ID-12345', {
				headers: { Cookie: cookie }
			});
			const json = await res.json();
			expect(JSON.stringify(json)).not.toMatch(/sqlite|better-sqlite|stack trace|Error at/i);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 6: Security Headers
	// ══════════════════════════════════════════════════════════════════════════

	describe('Security Headers', () => {
		it('API responses include X-Content-Type-Options: nosniff', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		});

		it('API responses include X-Frame-Options: DENY', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(res.headers.get('x-frame-options')).toBe('DENY');
		});

		it('API responses include Referrer-Policy', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(res.headers.get('referrer-policy')).toBeTruthy();
		});

		it('API responses include Content-Security-Policy', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(res.headers.get('content-security-policy')).toBeTruthy();
		});

		it('attachment download includes X-Content-Type-Options: nosniff', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const res = await app.request('/api/attachments/att-1', { headers: { Cookie: cookie } });
			expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 7: CORS Enforcement
	// ══════════════════════════════════════════════════════════════════════════

	describe('CORS Enforcement', () => {
		it('allows requests from trusted localhost origin', async () => {
			const res = await app.request('/api/health', {
				headers: { Origin: 'http://localhost:5173' }
			});
			// The CORS middleware should reflect the allowed origin
			expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
		});

		it('does not reflect an untrusted external origin', async () => {
			const res = await app.request('/api/health', {
				headers: { Origin: 'https://evil.example.com' }
			});
			const acao = res.headers.get('access-control-allow-origin') ?? '';
			// Must not echo back the malicious origin or use wildcard
			expect(acao).not.toBe('https://evil.example.com');
			expect(acao).not.toBe('*');
		});

		it('wildcard CORS with credentials is not used', async () => {
			const res = await app.request('/api/health', {
				headers: { Origin: 'https://attacker.com' }
			});
			// Must not have both credentials: true and *
			const acao = res.headers.get('access-control-allow-origin') ?? '';
			const acac = res.headers.get('access-control-allow-credentials') ?? '';
			expect(acao === '*' && acac === 'true').toBe(false);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 8: Rate Limiting
	// ══════════════════════════════════════════════════════════════════════════

	describe('Rate Limiting', () => {
		it('rate-limits login after 10 failed attempts', async () => {
			// Make 10 failed attempts
			for (let i = 0; i < 10; i++) {
				await app.request('/api/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'student@example.test', password: 'wrong' })
				});
			}
			// 11th attempt should be rate limited
			const res = await app.request('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: 'student@example.test', password: 'wrong' })
			});
			expect(res.status).toBe(429);
			expect(res.headers.get('retry-after')).toBeTruthy();
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 9: Functional Regression — Student Workflow
	// ══════════════════════════════════════════════════════════════════════════

	describe('Functional Regression — Student Workflow', () => {
		it('student can complete full workflow: create → attach → view → comment → download', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');

			// Create grievance
			const created = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					title: 'Broken cupboard hinge in B-204',
					category: 'Room',
					description: 'The cupboard hinge in B-204 is broken and the door will not close properly.'
				})
			});
			expect(created.status).toBe(201);
			const grievance = await created.json();
			const id = grievance.data.id as string;
			expect(id).toMatch(/^GRV-\d{4}$/);
			expect(grievance.data.studentId).toBe('stu-1');
			expect(grievance.data.status).toBe('Open');

			// Upload attachment
			const form = new FormData();
			form.append('file', new File([PNG], 'hinge.png', { type: 'image/png' }));
			const uploaded = await app.request(`/api/grievances/${id}/attachments`, {
				method: 'POST',
				headers: { Cookie: cookie },
				body: form
			});
			expect(uploaded.status).toBe(201);
			const attMeta = await uploaded.json();
			expect(attMeta.data.filename).toBe('hinge.png');

			// View grievance
			const viewed = await app.request(`/api/grievances/${id}`, { headers: { Cookie: cookie } });
			expect(viewed.status).toBe(200);
			const viewedJson = await viewed.json();
			expect(viewedJson.data.attachments.length).toBeGreaterThan(0);

			// Add comment
			const commented = await app.request(`/api/grievances/${id}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ body: 'Following up — the hinge is getting worse.' })
			});
			expect(commented.status).toBe(201);

			// Download own attachment
			const downloaded = await app.request(`/api/attachments/${attMeta.data.id}`, {
				headers: { Cookie: cookie }
			});
			expect(downloaded.status).toBe(200);
			expect(downloaded.headers.get('content-type')).toBe('image/png');
			expect(downloaded.headers.get('content-disposition')).toContain('attachment');
			const bytes = Buffer.from(await downloaded.arrayBuffer());
			expect(bytes.equals(PNG)).toBe(true);

			// View own grievance list
			const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(list.status).toBe(200);
			const listJson = await list.json();
			expect(listJson.data.some((g: { id: string }) => g.id === id)).toBe(true);

			// Logout
			const logout = await app.request('/api/logout', {
				method: 'POST',
				headers: { Cookie: cookie }
			});
			expect(logout.status).toBe(200);
		});

		it('student can edit their own open grievance but not a resolved one', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');
			const edited = await app.request('/api/grievances/GRV-0008', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ title: 'Mess tables still dirty before dinner' })
			});
			expect(edited.status).toBe(200);
			const editedJson = await edited.json();
			expect(editedJson.data.title).toContain('still dirty');

			// Resolved grievance cannot be edited
			const rohan = await login(app, 'rohan@example.test', 'student123');
			const resolved = await app.request('/api/grievances/GRV-0004', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: rohan.cookie },
				body: JSON.stringify({ title: 'Trying to change a resolved ticket' })
			});
			expect(resolved.status).toBe(409);
			const resolvedJson = await resolved.json();
			expect(resolvedJson.code).toBe('conflict');
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 10: Functional Regression — Warden Workflow
	// ══════════════════════════════════════════════════════════════════════════

	describe('Functional Regression — Warden Workflow', () => {
		it('warden can view all grievances, add comments, and update status', async () => {
			const { cookie } = await login(app, 'warden@example.test', 'warden123');

			// View all grievances
			const list = await app.request('/api/grievances', { headers: { Cookie: cookie } });
			expect(list.status).toBe(200);
			const listJson = await list.json();
			expect(listJson.data.length).toBeGreaterThanOrEqual(5);

			// View specific grievance from another student
			const detail = await app.request('/api/grievances/GRV-0003', { headers: { Cookie: cookie } });
			expect(detail.status).toBe(200);

			// Read comments
			const comments = await app.request('/api/grievances/GRV-0003/comments', {
				headers: { Cookie: cookie }
			});
			expect(comments.status).toBe(200);

			// Add comment as warden
			const commented = await app.request('/api/grievances/GRV-0003/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ body: 'Warden response: looking into this Wi-Fi issue.' })
			});
			expect(commented.status).toBe(201);
			const commentJson = await commented.json();
			expect(commentJson.data.author.role).toBe('warden');

			// Update status
			const updated = await app.request('/api/grievances/GRV-0003', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ status: 'In Progress' })
			});
			expect(updated.status).toBe(200);
			const updatedJson = await updated.json();
			expect(updatedJson.data.status).toBe('In Progress');

			// Download attachment (warden is authorized)
			const att = await app.request('/api/attachments/att-3', { headers: { Cookie: cookie } });
			expect(att.status).toBe(200);

			// Logout
			const logout = await app.request('/api/logout', {
				method: 'POST',
				headers: { Cookie: cookie }
			});
			expect(logout.status).toBe(200);
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// SECTION 7: Hierarchical RBAC & User Management
	// ══════════════════════════════════════════════════════════════════════════

	describe('Hierarchical RBAC & User Management', () => {
		it('admin login succeeds and returns admin role', async () => {
			const admin = await login(app, 'admin@example.test', 'admin123');
			expect(admin.res.status).toBe(200);
			expect(admin.json.user.role).toBe('admin');
			expect(admin.json.user.email).toBe('admin@example.test');
		});

		it('admin can list all users and view system stats', async () => {
			const { cookie } = await login(app, 'admin@example.test', 'admin123');

			const res = await app.request('/api/users', { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThanOrEqual(4);

			const statsRes = await app.request('/api/users/stats', { headers: { Cookie: cookie } });
			expect(statsRes.status).toBe(200);
			const statsJson = await statsRes.json();
			expect(statsJson.data.total).toBeGreaterThanOrEqual(4);
			expect(statsJson.data.admin).toBeGreaterThanOrEqual(1);
			expect(statsJson.data.warden).toBeGreaterThanOrEqual(1);
			expect(statsJson.data.student).toBeGreaterThanOrEqual(1);
		});

		it('admin can create student, warden, and admin accounts', async () => {
			const { cookie } = await login(app, 'admin@example.test', 'admin123');

			// Create student with Roll No and assigned Warden
			const stuRes = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'New Student Test',
					email: 'newstu@example.test',
					password: 'password123',
					role: 'student',
					room: 'D-101',
					rollNo: '23BCE9001',
					wardenId: 'war-1'
				})
			});
			expect(stuRes.status).toBe(201);
			const stuJson = await stuRes.json();
			expect(stuJson.data.role).toBe('student');
			expect(stuJson.data.rollNo).toBe('23BCE9001');
			expect(stuJson.data.wardenId).toBe('war-1');

			// Create warden with Emp ID
			const warRes = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'New Warden Test',
					email: 'newwar@example.test',
					password: 'password123',
					role: 'warden',
					empId: 'EMP-9001'
				})
			});
			expect(warRes.status).toBe(201);
			const warJson = await warRes.json();
			expect(warJson.data.role).toBe('warden');
			expect(warJson.data.empId).toBe('EMP-9001');

			// Create admin
			const admRes = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'New Admin Test',
					email: 'newadm@example.test',
					password: 'password123',
					role: 'admin',
					empId: 'ADM-9001'
				})
			});
			expect(admRes.status).toBe(201);
			const admJson = await admRes.json();
			expect(admJson.data.role).toBe('admin');
		});

		it('admin can update users and delete a grievance', async () => {
			const { cookie } = await login(app, 'admin@example.test', 'admin123');

			// Update student room, name, and roll number
			const updateRes = await app.request('/api/users/stu-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ name: 'Aarav Mehta Updated', room: 'Z-999', rollNo: '21BCE1042-UPD' })
			});
			expect(updateRes.status).toBe(200);
			const updateJson = await updateRes.json();
			expect(updateJson.data.name).toBe('Aarav Mehta Updated');
			expect(updateJson.data.room).toBe('Z-999');
			expect(updateJson.data.rollNo).toBe('21BCE1042-UPD');

			// Admin delete grievance
			const delGrv = await app.request('/api/grievances/GRV-0001', {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(delGrv.status).toBe(200);
		});

		it('admin cannot delete own logged-in account', async () => {
			const { cookie, json } = await login(app, 'admin@example.test', 'admin123');
			const selfId = json.user.id;

			const delRes = await app.request(`/api/users/${selfId}`, {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(delRes.status).toBe(400);
		});

		it('warden can manage students but cannot see or modify wardens/admins', async () => {
			const { cookie } = await login(app, 'warden@example.test', 'warden123');

			// Warden listing users only returns students
			const listRes = await app.request('/api/users', { headers: { Cookie: cookie } });
			expect(listRes.status).toBe(200);
			const listJson = await listRes.json();
			expect(listJson.data.every((u: { role: string }) => u.role === 'student')).toBe(true);

			// Warden can create a student (automatically assigned to this warden)
			const createStu = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'Warden Added Student',
					email: 'wstudent@example.test',
					password: 'password123',
					role: 'student',
					rollNo: '23BCS8001',
					room: 'E-201'
				})
			});
			expect(createStu.status).toBe(201);
			const createdStuJson = await createStu.json();
			expect(createdStuJson.data.wardenId).toBe('war-1');

			// Warden cannot create a warden or admin
			const createWar = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'Illegal Warden',
					email: 'illegalw@example.test',
					password: 'password123',
					role: 'warden',
					empId: 'EMP-ILLEGAL'
				})
			});
			expect(createWar.status).toBe(403);

			// Warden cannot modify warden or admin accounts
			const editWar = await app.request('/api/users/war-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ name: 'Hacked Warden' })
			});
			expect(editWar.status).toBe(403);

			const editAdm = await app.request('/api/users/adm-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ name: 'Hacked Admin' })
			});
			expect(editAdm.status).toBe(403);

			// Warden cannot delete admin or warden accounts
			const delAdm = await app.request('/api/users/adm-1', {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(delAdm.status).toBe(403);

			// Warden can delete the student they created
			const delStu = await app.request(`/api/users/${createdStuJson.data.id}`, {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(delStu.status).toBe(200);
		});

		it('students cannot access any user management endpoints', async () => {
			const { cookie } = await login(app, 'student@example.test', 'student123');

			// List
			const list = await app.request('/api/users', { headers: { Cookie: cookie } });
			expect(list.status).toBe(403);

			// Create
			const create = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({
					name: 'Student Escalation',
					email: 'esc@example.test',
					password: 'password123',
					role: 'admin'
				})
			});
			expect(create.status).toBe(403);

			// Edit
			const edit = await app.request('/api/users/war-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ name: 'Hacked' })
			});
			expect(edit.status).toBe(403);

			// Delete
			const del = await app.request('/api/users/stu-2', {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(del.status).toBe(403);

			// Delete grievance
			const delGrv = await app.request('/api/grievances/GRV-0001', {
				method: 'DELETE',
				headers: { Cookie: cookie }
			});
			expect(delGrv.status).toBe(403);
		});
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Admin Audit Logs System Tests
	// ────────────────────────────────────────────────────────────────────────────

	describe('Admin Audit Logs & Activity Surveillance', () => {
		it('admin can list audit logs and view aggregated audit statistics', async () => {
			const { cookie } = await login(app, 'admin@example.test', 'admin123');

			const res = await app.request('/api/audit-logs', { headers: { Cookie: cookie } });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json).toHaveProperty('data');
			expect(json).toHaveProperty('total');
			expect(Array.isArray(json.data)).toBe(true);
			expect(json.data.length).toBeGreaterThan(0);

			const statsRes = await app.request('/api/audit-logs/stats', { headers: { Cookie: cookie } });
			expect(statsRes.status).toBe(200);
			const statsJson = await statsRes.json();
			expect(statsJson.data).toHaveProperty('totalEvents');
			expect(statsJson.data).toHaveProperty('studentEvents');
			expect(statsJson.data).toHaveProperty('wardenEvents');
			expect(statsJson.data).toHaveProperty('adminEvents');
		});

		it('students and wardens cannot access audit logs (403 Forbidden)', async () => {
			// Student attempt
			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');
			const stuRes = await app.request('/api/audit-logs', { headers: { Cookie: stuCookie } });
			expect(stuRes.status).toBe(403);

			const stuStats = await app.request('/api/audit-logs/stats', { headers: { Cookie: stuCookie } });
			expect(stuStats.status).toBe(403);

			// Warden attempt
			const { cookie: warCookie } = await login(app, 'warden@example.test', 'warden123');
			const warRes = await app.request('/api/audit-logs', { headers: { Cookie: warCookie } });
			expect(warRes.status).toBe(403);

			const warStats = await app.request('/api/audit-logs/stats', { headers: { Cookie: warCookie } });
			expect(warStats.status).toBe(403);

			// Unauthenticated attempt
			const unauthRes = await app.request('/api/audit-logs');
			expect(unauthRes.status).toBe(401);
		});

		it('student filing a grievance automatically creates an audit log entry', async () => {
			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');

			const createRes = await app.request('/api/grievances', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: stuCookie },
				body: JSON.stringify({
					title: 'Broken ceiling fan in common room',
					category: 'Electricity',
					description: 'The ceiling fan has stopped rotating and makes a buzzing sound when turned on.'
				})
			});
			expect(createRes.status).toBe(201);
			const createdJson = await createRes.json();
			const grievanceId = createdJson.data.id;

			// Verify via admin audit logs
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');
			const auditRes = await app.request(`/api/audit-logs?search=${grievanceId}`, { headers: { Cookie: admCookie } });
			expect(auditRes.status).toBe(200);
			const auditJson = await auditRes.json();

			expect(auditJson.data.length).toBeGreaterThan(0);
			const matching = auditJson.data.find((l: any) => l.targetId === grievanceId && l.eventType === 'grievance.created');
			expect(matching).toBeDefined();
			expect(matching.actorRole).toBe('student');
			expect(matching.actorName).toBe('Aarav Mehta');
			expect(matching.details.category).toBe('Electricity');
		});

		it('warden changing grievance status automatically creates an audit log entry', async () => {
			const { cookie: warCookie } = await login(app, 'warden@example.test', 'warden123');

			const patchRes = await app.request('/api/grievances/GRV-0003', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: warCookie },
				body: JSON.stringify({ status: 'in_progress' })
			});
			expect(patchRes.status).toBe(200);

			// Verify via admin audit logs
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');
			const auditRes = await app.request('/api/audit-logs?search=GRV-0003', { headers: { Cookie: admCookie } });
			expect(auditRes.status).toBe(200);
			const auditJson = await auditRes.json();

			const statusChangeLog = auditJson.data.find((l: any) => l.targetId === 'GRV-0003' && l.eventType === 'grievance.status_changed');
			expect(statusChangeLog).toBeDefined();
			expect(statusChangeLog.actorRole).toBe('warden');
			expect(statusChangeLog.actorName).toBe('Mr. K. Sahu');
			expect(statusChangeLog.details.newStatus).toBe('In Progress');
		});

		it('student and warden comments create audit log entries', async () => {
			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');

			const cmtRes = await app.request('/api/grievances/GRV-0001/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: stuCookie },
				body: JSON.stringify({ body: 'Please resolve this urgently as water is increasing.' })
			});
			expect(cmtRes.status).toBe(201);

			// Verify via admin audit logs
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');
			const auditRes = await app.request('/api/audit-logs?eventType=comment.created', { headers: { Cookie: admCookie } });
			expect(auditRes.status).toBe(200);
			const auditJson = await auditRes.json();

			const commentLog = auditJson.data.find((l: any) => l.targetId === 'GRV-0001' && l.eventType === 'comment.created');
			expect(commentLog).toBeDefined();
			expect(commentLog.actorRole).toBe('student');
		});

		it('warden creating a student account creates an audit log entry', async () => {
			const { cookie: warCookie } = await login(app, 'warden@example.test', 'warden123');

			const createRes = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: warCookie },
				body: JSON.stringify({
					name: 'Test Audit Student',
					email: 'testauditstu@example.test',
					password: 'password123',
					role: 'student',
					rollNo: '23BCE7777',
					room: 'C-301'
				})
			});
			expect(createRes.status).toBe(201);
			const created = await createRes.json();

			// Verify via admin audit logs
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');
			const auditRes = await app.request(`/api/audit-logs?search=${created.data.id}`, { headers: { Cookie: admCookie } });
			expect(auditRes.status).toBe(200);
			const auditJson = await auditRes.json();

			const userCreateLog = auditJson.data.find((l: any) => l.targetId === created.data.id && l.eventType === 'user.created');
			expect(userCreateLog).toBeDefined();
			expect(userCreateLog.actorRole).toBe('warden');
			expect(userCreateLog.details.email).toBe('testauditstu@example.test');
		});

		it('supports audit log role filters, search, and CSV/JSON export', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			// Filter by student role
			const stuOnly = await app.request('/api/audit-logs?role=student', { headers: { Cookie: admCookie } });
			expect(stuOnly.status).toBe(200);
			const stuJson = await stuOnly.json();
			expect(stuJson.data.every((l: any) => l.actorRole === 'student')).toBe(true);

			// Filter by warden role
			const warOnly = await app.request('/api/audit-logs?role=warden', { headers: { Cookie: admCookie } });
			expect(warOnly.status).toBe(200);
			const warJson = await warOnly.json();
			expect(warJson.data.every((l: any) => l.actorRole === 'warden')).toBe(true);

			// Export CSV
			const csvRes = await app.request('/api/audit-logs/export?format=csv', { headers: { Cookie: admCookie } });
			expect(csvRes.status).toBe(200);
			expect(csvRes.headers.get('content-type')).toContain('text/csv');
			const csvText = await csvRes.text();
			expect(csvText).toContain('Timestamp');
			expect(csvText).toContain('Actor Role');

			// Export JSON
			const jsonRes = await app.request('/api/audit-logs/export?format=json', { headers: { Cookie: admCookie } });
			expect(jsonRes.status).toBe(200);
			const exportData = await jsonRes.json();
			expect(Array.isArray(exportData.data)).toBe(true);
		});
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Student Post-Resolution Review & Verification Tests
	// ────────────────────────────────────────────────────────────────────────────

	describe('Student Post-Resolution Review & Solution Picture', () => {
		it('student can submit resolution review with rating, feedback, and solution picture on a resolved grievance', async () => {
			// GRV-0004 is owned by stu-3 (Rohan Das) and is 'resolved'
			const { cookie: stuCookie } = await login(app, 'rohan@example.test', 'student123');

			const form = new FormData();
			form.append('rating', '5');
			form.append('feedback', 'The third floor common area has been completely cleaned. Very satisfied!');
			form.append('file', new File([PNG], 'solution-fix.png', { type: 'image/png' }));

			const res = await app.request('/api/grievances/GRV-0004/review', {
				method: 'POST',
				headers: { Cookie: stuCookie },
				body: form
			});

			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data).toHaveProperty('review');
			expect(json.data.review).not.toBeNull();
			expect(json.data.review.rating).toBe(5);
			expect(json.data.review.feedback).toContain('completely cleaned');
			expect(json.data.review.solutionAttachment).toBeDefined();
			expect(json.data.review.solutionAttachment.filename).toBe('solution-fix.png');

			// GET /api/grievances/GRV-0004/review
			const getRev = await app.request('/api/grievances/GRV-0004/review', { headers: { Cookie: stuCookie } });
			expect(getRev.status).toBe(200);
			const getRevJson = await getRev.json();
			expect(getRevJson.data.rating).toBe(5);

			// Verify Admin Audit Log captured review.submitted
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');
			const auditRes = await app.request('/api/audit-logs?search=GRV-0004', { headers: { Cookie: admCookie } });
			expect(auditRes.status).toBe(200);
			const auditJson = await auditRes.json();
			const reviewAudit = auditJson.data.find((l: any) => l.eventType === 'review.submitted' && l.targetId === 'GRV-0004');
			expect(reviewAudit).toBeDefined();
			expect(reviewAudit.actorRole).toBe('student');
			expect(reviewAudit.actorName).toBe('Rohan Das');
		});

		it('submitting review on an open or in-progress grievance is rejected (409 conflict)', async () => {
			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');

			// GRV-0001 is Open
			const form = new FormData();
			form.append('rating', '4');
			form.append('feedback', 'Premature review attempt');
			form.append('file', new File([PNG], 'test.png', { type: 'image/png' }));

			const res = await app.request('/api/grievances/GRV-0001/review', {
				method: 'POST',
				headers: { Cookie: stuCookie },
				body: form
			});

			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.code).toBe('conflict');
		});

		it('student cannot submit review on another student grievance (403 forbidden)', async () => {
			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');

			// GRV-0007 is owned by stu-3 (Rohan)
			const form = new FormData();
			form.append('rating', '5');
			form.append('feedback', 'Trying to review another student ticket');
			form.append('file', new File([PNG], 'test.png', { type: 'image/png' }));

			const res = await app.request('/api/grievances/GRV-0007/review', {
				method: 'POST',
				headers: { Cookie: stuCookie },
				body: form
			});

			expect(res.status).toBe(403);
			const json = await res.json();
			expect(json.code).toBe('unauthorized');
		});

		it('wardens and admins cannot submit resolution reviews (403 forbidden)', async () => {
			const { cookie: warCookie } = await login(app, 'warden@example.test', 'warden123');

			const form = new FormData();
			form.append('rating', '5');
			form.append('feedback', 'Warden review attempt');
			form.append('file', new File([PNG], 'test.png', { type: 'image/png' }));

			const res = await app.request('/api/grievances/GRV-0004/review', {
				method: 'POST',
				headers: { Cookie: warCookie },
				body: form
			});

			expect(res.status).toBe(403);
		});

		it('submitting review without a picture or invalid rating is rejected (400 bad_request)', async () => {
			// First resolve GRV-0002 for stu-1
			const { cookie: warCookie } = await login(app, 'warden@example.test', 'warden123');
			await app.request('/api/grievances/GRV-0002', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: warCookie },
				body: JSON.stringify({ status: 'Resolved' })
			});

			const { cookie: stuCookie } = await login(app, 'student@example.test', 'student123');

			// Missing file
			const formNoFile = new FormData();
			formNoFile.append('rating', '5');
			formNoFile.append('feedback', 'Missing file test feedback');

			const noFileRes = await app.request('/api/grievances/GRV-0002/review', {
				method: 'POST',
				headers: { Cookie: stuCookie },
				body: formNoFile
			});
			expect(noFileRes.status).toBe(400);

			// Invalid rating
			const formBadRating = new FormData();
			formBadRating.append('rating', '10');
			formBadRating.append('feedback', 'Invalid rating test feedback');
			formBadRating.append('file', new File([PNG], 'test.png', { type: 'image/png' }));

			const badRatingRes = await app.request('/api/grievances/GRV-0002/review', {
				method: 'POST',
				headers: { Cookie: stuCookie },
				body: formBadRating
			});
			expect(badRatingRes.status).toBe(400);
		});
	});

	// ────────────────────────────────────────────────────────────────────────────
	// Student-Warden 1-to-1 Mapping, Roll No, and Employee ID Tests
	// ────────────────────────────────────────────────────────────────────────────

	describe('Student-Warden 1-to-1 Mapping, Roll No, and Employee ID', () => {
		it('warden can only list their own assigned students', async () => {
			// war-1 (Mr. K. Sahu) is assigned to stu-1 and stu-2
			const { cookie: war1Cookie } = await login(app, 'warden@example.test', 'warden123');
			const listWar1 = await app.request('/api/users', { headers: { Cookie: war1Cookie } });
			expect(listWar1.status).toBe(200);
			const jsonWar1 = await listWar1.json();
			expect(jsonWar1.data.every((s: any) => s.wardenId === 'war-1')).toBe(true);
			expect(jsonWar1.data.some((s: any) => s.id === 'stu-1')).toBe(true);
			expect(jsonWar1.data.some((s: any) => s.id === 'stu-2')).toBe(true);
			expect(jsonWar1.data.some((s: any) => s.id === 'stu-3')).toBe(false); // stu-3 belongs to war-2

			// war-2 (Mr. R. K. Mishra) is assigned to stu-3
			const { cookie: war2Cookie } = await login(app, 'warden2@example.test', 'warden123');
			const listWar2 = await app.request('/api/users', { headers: { Cookie: war2Cookie } });
			expect(listWar2.status).toBe(200);
			const jsonWar2 = await listWar2.json();
			expect(jsonWar2.data.every((s: any) => s.wardenId === 'war-2')).toBe(true);
			expect(jsonWar2.data.some((s: any) => s.id === 'stu-3')).toBe(true);
			expect(jsonWar2.data.some((s: any) => s.id === 'stu-1')).toBe(false);
		});

		it('warden only sees grievances filed by their assigned students', async () => {
			// war-1 should see grievances for stu-1 and stu-2, but not stu-3 (GRV-0004, GRV-0006, GRV-0007)
			const { cookie: war1Cookie } = await login(app, 'warden@example.test', 'warden123');
			const grvRes1 = await app.request('/api/grievances', { headers: { Cookie: war1Cookie } });
			expect(grvRes1.status).toBe(200);
			const grvJson1 = await grvRes1.json();
			expect(grvJson1.data.every((g: any) => g.student.wardenId === 'war-1')).toBe(true);
			expect(grvJson1.data.some((g: any) => g.id === 'GRV-0004')).toBe(false);

			// war-2 should see grievances for stu-3
			const { cookie: war2Cookie } = await login(app, 'warden2@example.test', 'warden123');
			const grvRes2 = await app.request('/api/grievances', { headers: { Cookie: war2Cookie } });
			expect(grvRes2.status).toBe(200);
			const grvJson2 = await grvRes2.json();
			expect(grvJson2.data.every((g: any) => g.student.wardenId === 'war-2')).toBe(true);
			expect(grvJson2.data.some((g: any) => g.id === 'GRV-0004')).toBe(true);
		});

		it('rejects duplicate student roll number with 409 conflict', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			// Try creating student with already existing rollNo '21BCE1042'
			const res = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: admCookie },
				body: JSON.stringify({
					name: 'Duplicate Roll Student',
					email: 'duproll@example.test',
					password: 'password123',
					role: 'student',
					rollNo: '21BCE1042',
					wardenId: 'war-1'
				})
			});
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error).toContain('roll number');
		});

		it('rejects duplicate warden employee ID with 409 conflict', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			// Try creating warden with already existing empId 'EMP-1001'
			const res = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: admCookie },
				body: JSON.stringify({
					name: 'Duplicate Emp Warden',
					email: 'dupemp@example.test',
					password: 'password123',
					role: 'warden',
					empId: 'EMP-1001'
				})
			});
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error).toContain('employee ID');
		});

		it('rejects assigning student to non-existent or non-warden account (400 bad_request)', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			const res = await app.request('/api/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: admCookie },
				body: JSON.stringify({
					name: 'Invalid Warden Student',
					email: 'invwar@example.test',
					password: 'password123',
					role: 'student',
					rollNo: '24BCE1111',
					wardenId: 'stu-1' // stu-1 is not a warden
				})
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error).toContain('Assigned warden');
		});

		it('admin can list all users and inspect rollNo, empId, and populated warden profile', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			const res = await app.request('/api/users', { headers: { Cookie: admCookie } });
			expect(res.status).toBe(200);
			const json = await res.json();

			const stu1 = json.data.find((u: any) => u.id === 'stu-1');
			expect(stu1).toBeDefined();
			expect(stu1.rollNo).toBeDefined();
			expect(stu1.warden).toBeDefined();
			expect(stu1.warden.name).toBe('Mr. K. Sahu');
			expect(stu1.warden.empId).toBe('EMP-1001');

			const war1 = json.data.find((u: any) => u.id === 'war-1');
			expect(war1).toBeDefined();
			expect(war1.empId).toBe('EMP-1001');
		});

		it('admin can reassign a student to another warden', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			// Reassign stu-1 to war-2
			const patchRes = await app.request('/api/users/stu-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: admCookie },
				body: JSON.stringify({ wardenId: 'war-2' })
			});
			expect(patchRes.status).toBe(200);
			const patchJson = await patchRes.json();
			expect(patchJson.data.wardenId).toBe('war-2');
			expect(patchJson.data.warden.name).toBe('Mr. R. K. Mishra');

			// Reassign back to war-1
			await app.request('/api/users/stu-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', Cookie: admCookie },
				body: JSON.stringify({ wardenId: 'war-1' })
			});
		});

		it('GET /api/users/wardens returns list of all wardens for admin assignment', async () => {
			const { cookie: admCookie } = await login(app, 'admin@example.test', 'admin123');

			const res = await app.request('/api/users/wardens', { headers: { Cookie: admCookie } });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(Array.isArray(json.data)).toBe(true);
			expect(json.data.length).toBeGreaterThanOrEqual(2);
			expect(json.data.every((w: any) => w.role === 'warden')).toBe(true);
			expect(json.data.some((w: any) => w.empId === 'EMP-1001')).toBe(true);
		});
	});
});



