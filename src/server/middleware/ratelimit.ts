import type { Context, Next } from 'hono';
import { HttpError } from '../http/errors.ts';
import { securityLog } from '../logger.ts';

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	message?: string;
}

const store = new Map<string, number[]>();

export function resetRateLimitStore(): void {
	store.clear();
}

function pruneWindow(timestamps: number[], windowStart: number): number[] {
	return timestamps.filter((t) => t > windowStart);
}

function getKey(c: Context, useUserId: boolean): string {
	if (useUserId) {
		const userId = c.get('rateLimitUserId' as never) as string | undefined;
		if (userId) return `user:${userId}`;
	}
	const forwarded = c.req.header('x-forwarded-for');
	const ip = forwarded ? forwarded.split(',')[0].trim() : (c.req.header('x-real-ip') ?? 'unknown');
	return `ip:${ip}`;
}

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

export const loginRateLimit = rateLimitMiddleware(
	{
		maxRequests: 10,
		windowMs: 15 * 60 * 1000,
		message: 'Too many login attempts. Please try again in 15 minutes.'
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
		const now = Date.now();
		for (const [key, timestamps] of store.entries()) {
			const pruned = pruneWindow(timestamps, now - 60 * 60 * 1000);
			if (pruned.length === 0) {
				store.delete(key);
			} else {
				store.set(key, pruned);
			}
		}
	},
	30 * 60 * 1000
).unref();
