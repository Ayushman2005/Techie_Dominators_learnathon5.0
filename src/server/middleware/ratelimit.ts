/**
 * In-memory sliding-window rate limiter.
 *
 * This is a lightweight, dependency-free rate limiter suitable for
 * single-instance university deployments. For multi-instance deployments,
 * replace with a Redis-backed rate limiter (e.g. @hono/rate-limiter-redis).
 *
 * Design:
 * - Tracks request timestamps per key (IP for login, userId for others)
 * - Sliding window: only timestamps within the last `windowMs` ms are counted
 * - Old entries are pruned on each check to prevent memory leaks
 * - Limits are intentionally conservative to allow legitimate use
 */

import type { Context, Next } from 'hono';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

interface RateLimitConfig {
	/** Maximum requests allowed in the window */
	maxRequests: number;
	/** Window size in milliseconds */
	windowMs: number;
	/** Human-readable limit description for error messages */
	message?: string;
}

// Global in-memory store: key → array of request timestamps
const store = new Map<string, number[]>();

/**
 * Reset the rate limit store. Used in tests to isolate each test case
 * from rate limit state accumulated in previous tests.
 * NOT exported in production; only for test environments.
 */
export function resetRateLimitStore(): void {
	store.clear();
}

/**
 * Prune old timestamps outside the sliding window.
 * Called on every request to prevent unbounded memory growth.
 */
function pruneWindow(timestamps: number[], windowStart: number): number[] {
	return timestamps.filter((t) => t > windowStart);
}

/**
 * Get a rate-limit key from the context.
 * For login: use remote IP (prevents credential stuffing regardless of account).
 * For authenticated endpoints: use userId (per-user fairness, not IP-based).
 */
function getKey(c: Context, useUserId: boolean): string {
	if (useUserId) {
		// If userId available (set after auth middleware), prefer it
		const userId = c.get('rateLimitUserId' as never) as string | undefined;
		if (userId) return `user:${userId}`;
	}
	// Fall back to IP address — check standard proxy headers first
	const forwarded = c.req.header('x-forwarded-for');
	const ip = forwarded ? forwarded.split(',')[0].trim() : (c.req.header('x-real-ip') ?? 'unknown');
	return `ip:${ip}`;
}

/**
 * Build a Hono middleware that enforces rate limits.
 *
 * @param config Rate limit configuration
 * @param useUserId If true, key by userId rather than IP (for authenticated endpoints)
 */
export function rateLimitMiddleware(config: RateLimitConfig, useUserId = false) {
	const { maxRequests, windowMs, message = 'Too many requests. Please try again later.' } = config;

	return async (c: Context, next: Next) => {
		const key = getKey(c, useUserId);
		const now = Date.now();
		const windowStart = now - windowMs;

		const current = store.get(key) ?? [];
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
			throw new HttpError(429, 'bad_request', message);
		}

		active.push(now);
		store.set(key, active);

		c.header('X-RateLimit-Limit', String(maxRequests));
		c.header('X-RateLimit-Remaining', String(maxRequests - active.length));

		await next();
	};
}

/** Rate limiter for login endpoint: 10 attempts per 15 minutes per IP. */
export const loginRateLimit = rateLimitMiddleware(
	{
		maxRequests: 10,
		windowMs: 15 * 60 * 1000,
		message: 'Too many login attempts. Please try again in 15 minutes.'
	},
	false // key by IP — prevents credential stuffing even across accounts
);

/** Rate limiter for grievance creation: 20 per hour per user. */
export const createGrievanceRateLimit = rateLimitMiddleware(
	{
		maxRequests: 20,
		windowMs: 60 * 60 * 1000,
		message: 'Too many grievances submitted. Please wait before submitting another.'
	},
	true
);

/** Rate limiter for comment creation: 30 per hour per user. */
export const commentRateLimit = rateLimitMiddleware(
	{
		maxRequests: 30,
		windowMs: 60 * 60 * 1000,
		message: 'Too many comments posted. Please wait before adding another.'
	},
	true
);

/**
 * Periodically clean up fully-expired entries from the store.
 * Runs every 30 minutes to prevent unbounded memory growth in long-running processes.
 */
setInterval(
	() => {
		const now = Date.now();
		for (const [key, timestamps] of store.entries()) {
			// Use the longest possible window (1 hour) to be conservative
			const pruned = pruneWindow(timestamps, now - 60 * 60 * 1000);
			if (pruned.length === 0) {
				store.delete(key);
			} else {
				store.set(key, pruned);
			}
		}
	},
	30 * 60 * 1000
).unref(); // .unref() prevents this timer from keeping the process alive
