/**
 * In-memory sliding-window rate limiter.
 *
 * This is a lightweight, dependency-free rate limiter suitable for
 * single-instance university deployments.
 */
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

function getKey(c: Context, useUserId: boolean): string {
	if (useUserId) {
		const userId = c.get('rateLimitUserId' as never) as string | undefined;
		if (userId) return `user:${userId}`;
	}
	const ip = getClientIp(c);
	return `ip:${ip}`;
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

/** Rate limiter for login endpoint: 10 attempts per minute per IP to prevent brute-force attacks. */
export const loginRateLimit = rateLimitMiddleware(
	{
		maxRequests: 10,
		windowMs: 60 * 1000, // 1 minute
		message: 'Too many login attempts. Please wait 1 minute before trying again.'
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
