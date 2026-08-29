/**
 * In-memory sliding-window rate limiter.
 *
 * This is a lightweight, dependency-free rate limiter suitable for
 * single-instance university deployments.
 */
<<<<<<< HEAD

import { getConnInfo } from '@hono/node-server/conninfo';
=======
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
import type { Context, Next } from 'hono';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';
import { TRUST_PROXY } from '../config.ts';

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	message?: string;
}

export interface RateLimitStore {
	get(key: string): Promise<number[]> | number[];
	set(key: string, timestamps: number[]): Promise<void> | void;
	clear(): Promise<void> | void;
}

export class InMemoryRateLimitStore implements RateLimitStore {
	private store = new Map<string, number[]>();

	get(key: string): number[] {
		return this.store.get(key) ?? [];
	}

	set(key: string, timestamps: number[]): void {
		this.store.set(key, timestamps);
	}

	clear(): void {
		this.store.clear();
	}

	prune(maxAgeMs: number): void {
		const now = Date.now();
		for (const [key, timestamps] of this.store.entries()) {
			const pruned = timestamps.filter((t) => t > now - maxAgeMs);
			if (pruned.length === 0) {
				this.store.delete(key);
			} else {
				this.store.set(key, pruned);
			}
		}
	}
}

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

export function setRateLimitStore(store: RateLimitStore): void {
	activeStore = store;
}

export function resetRateLimitStore(): void {
	activeStore.clear();
}

export function isTrustProxy(): boolean {
	const env = process.env.TRUST_PROXY;
	return env === 'true' || env === '1' || TRUST_PROXY;
}

export function getClientIp(c: Context): string {
	if (isTrustProxy()) {
		const forwarded = c.req.header('x-forwarded-for');
		if (forwarded) {
			const first = forwarded.split(',')[0].trim();
			if (first) return first;
		}
		const realIp = c.req.header('x-real-ip');
		if (realIp && realIp.trim()) return realIp.trim();
	}

	const rawReq = c.req.raw as unknown as { socket?: { remoteAddress?: string } };
	const socketIp = rawReq?.socket?.remoteAddress;
	if (socketIp) return socketIp;

	return '127.0.0.1';
}

function pruneWindow(timestamps: number[], windowStart: number): number[] {
	return timestamps.filter((t) => t > windowStart);
}

<<<<<<< HEAD
/**
 * Get a rate-limit key from the context.
 * For login: use remote IP (prevents credential stuffing regardless of account).
 * For authenticated endpoints: use userId (per-user fairness, not IP-based).
 */
/**
 * Get a rate-limit key from the context.
 * For login: use remote IP (prevents credential stuffing regardless of account).
 * For authenticated endpoints: use userId (per-user fairness, not IP-based).
 *
 * SECURITY: X-Forwarded-For is only trusted when TRUST_PROXY=true (i.e. when
 * a trusted reverse proxy is configured that strips/rewrites this header).
 * Trusting it unconditionally allows an attacker to spoof their IP and bypass
 * rate limiting by cycling through fake values in the header.
 */
=======
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
function getKey(c: Context, useUserId: boolean): string {
	if (useUserId) {
		const userId = c.get('rateLimitUserId' as never) as string | undefined;
		if (userId) return `user:${userId}`;
	}
<<<<<<< HEAD
	// Only trust proxy headers when TRUST_PROXY is explicitly enabled
	if (TRUST_PROXY) {
		const forwarded = c.req.header('x-forwarded-for');
		if (forwarded) {
			const ip = forwarded.split(',')[0].trim();
			if (ip) return `ip:${ip}`;
		}
		const realIp = c.req.header('x-real-ip');
		if (realIp) return `ip:${realIp.trim()}`;
	}
	// Without a trusted proxy, fall back to the underlying socket IP.
	try {
		const info = getConnInfo(c);
		if (info && info.remote.address) {
			return `ip:${info.remote.address}`;
		}
	} catch {
		// Fallback if getConnInfo fails for any reason
	}
	
	// Absolute worst-case fallback, though getConnInfo should rarely fail in Node.
	const userAgent = c.req.header('user-agent') ?? 'ua-unknown';
	const acceptLang = c.req.header('accept-language') ?? 'lang-unknown';
	return `fingerprint:${userAgent.slice(0, 80)}:${acceptLang.slice(0, 20)}`;
=======
	const ip = getClientIp(c);
	return `ip:${ip}`;
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
}

export function rateLimitMiddleware(config: RateLimitConfig, useUserId = false) {
	const { maxRequests, windowMs, message = 'Too many requests. Please try again later.' } = config;

	return async (c: Context, next: Next) => {
		const key = getKey(c, useUserId);
		const now = Date.now();
		const windowStart = now - windowMs;

		const current = (await activeStore.get(key)) ?? [];
		const active = pruneWindow(current, windowStart);

		if (active.length >= maxRequests) {
			securityLog('rate_limit_exceeded', {
				key,
				path: c.req.path,
				requestCount: active.length,
				windowMs
			});
			const retryAfterSec = Math.ceil(windowMs / 1000);
			c.header('Retry-After', String(retryAfterSec));
			c.header('X-RateLimit-Limit', String(maxRequests));
			c.header('X-RateLimit-Remaining', '0');
			throw new HttpError(429, 'rate_limited', message);
		}

		active.push(now);
		await activeStore.set(key, active);

		c.header('X-RateLimit-Limit', String(maxRequests));
		c.header('X-RateLimit-Remaining', String(maxRequests - active.length));

		await next();
	};
}

<<<<<<< HEAD
/** Rate limiter for login endpoint: 3 attempts per 2 minutes per IP to prevent brute-force attacks. */
export const loginRateLimit = rateLimitMiddleware(
	{
		maxRequests: 3,
		windowMs: 2 * 60 * 1000, // 2 minutes
		message: 'Too many login attempts. Please wait 2 minutes before trying again.'
=======
/** Rate limiter for login endpoint: 10 attempts per minute per IP to prevent brute-force attacks. */
export const loginRateLimit = rateLimitMiddleware(
	{
		maxRequests: 10,
		windowMs: 60 * 1000, // 1 minute
		message: 'Too many login attempts. Please wait 1 minute before trying again.'
>>>>>>> 453c5e2cb4dda84e8dd81061d403836ed12ed700
	},
	false
);

export const createGrievanceRateLimit = rateLimitMiddleware(
	{
		maxRequests: 20,
		windowMs: 60 * 60 * 1000,
		message: 'Too many grievances submitted. Please wait before submitting another.'
	},
	true
);

export const commentRateLimit = rateLimitMiddleware(
	{
		maxRequests: 30,
		windowMs: 60 * 60 * 1000,
		message: 'Too many comments posted. Please wait before adding another.'
	},
	true
);

setInterval(
	() => {
		if (activeStore instanceof InMemoryRateLimitStore) {
			activeStore.prune(60 * 60 * 1000);
		}
	},
	30 * 60 * 1000
).unref();
