import { authService } from '$lib/services';
import type { User } from '$lib/types';

let current = $state<User | null>(authService.restore());

export function getSession(): User | null {
	return current;
}

export function isStudent(): boolean {
	return current?.role === 'student';
}

export function isWarden(): boolean {
	return current?.role === 'warden';
}

export function isAdmin(): boolean {
	return current?.role === 'admin';
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
	const result = await authService.signIn(email, password);
	if (result.ok) {
		current = result.user;
		return { ok: true };
	}
	return { ok: false, error: result.error };
}

export async function signOut(): Promise<void> {
	await authService.signOut();
	current = null;
}
