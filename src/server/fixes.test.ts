import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from './app.ts';
import { openDatabase } from './db/connection.ts';
import { seedMockData } from './db/seed.ts';
import { resetRateLimitStore } from './middleware/ratelimit.ts';
import type { Database } from 'better-sqlite3';

function cookieHeader(res: Response): string {
	const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
	const list = anyHeaders.getSetCookie?.() ?? [];
	if (list.length > 0) {
		return list.map((v) => v.split(';')[0]).join('; ');
	}
	const raw = res.headers.get('set-cookie');
	return raw ? raw.split(';')[0] : '';
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
	const res = await app.request('/api/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
	const json = await res.json();
	return { res, json, cookie: cookieHeader(res) };
}

describe('Verified Bug Fixes & Regression Suite', () => {
	let dir: string;
	let app: ReturnType<typeof createApp>;
	let db: Database;

	beforeEach(() => {
		resetRateLimitStore();
		dir = mkdtempSync(join(tmpdir(), 'hg-fix-'));
		db = openDatabase(join(dir, 'hostel.db'));
		const uploadDir = join(dir, 'uploads');
		seedMockData(db, uploadDir);
		app = createApp({ db, uploadsDir: uploadDir });
	});

	afterEach(() => {
		try {
			db.close();
			rmSync(dir, { recursive: true, force: true });
		} catch {}
	});

	it('Fix 1: Authenticated student can access GET /api/users/wardens without 403 Forbidden', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/users/wardens', {
			headers: { Cookie: cookie }
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(Array.isArray(json.data)).toBe(true);
		expect(json.data.length).toBeGreaterThanOrEqual(1);
		expect(json.data[0].role).toBe('warden');
	});

	it('Fix 2: Warden can update grievance status via PATCH /api/grievances/:id', async () => {
		const { cookie } = await login(app, 'warden@example.test', 'warden123');
		const res = await app.request('/api/grievances/GRV-0001', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({ status: 'In Progress' })
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.status).toBe('In Progress');
	});

	it('Fix 3: GET /api/audit-logs/export?format=csv returns CSV file for admin', async () => {
		const { cookie } = await login(app, 'admin@example.test', 'admin123');
		const res = await app.request('/api/audit-logs/export?format=csv', {
			headers: { Cookie: cookie }
		});
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/csv');
		const text = await res.text();
		expect(text).toContain('Timestamp');
		expect(text).toContain('Actor Role');
	});

	it('Fix 4: GET /api/audit-logs/stats returns security stats for admin', async () => {
		const { cookie } = await login(app, 'admin@example.test', 'admin123');
		const res = await app.request('/api/audit-logs/stats', {
			headers: { Cookie: cookie }
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data).toBeDefined();
		expect(typeof json.data.totalEvents).toBe('number');
	});

	it('Fix 5: Student filing grievance returns standard { data: grievance } format', async () => {
		const { cookie } = await login(app, 'student@example.test', 'student123');
		const res = await app.request('/api/grievances', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Room Door Lock Jammed Completely',
				category: 'Room',
				description: 'The key does not turn properly in the cylinder and gets stuck.',
				priority: 'high',
				availableTime: 'Evenings 6 PM'
			})
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json.data).toBeDefined();
		expect(json.data.id).toMatch(/^GRV-/);
		expect(json.data.title).toBe('Room Door Lock Jammed Completely');
	});
});
